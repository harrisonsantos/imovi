import { z } from 'zod';
import { and, eq } from '@imovi/db/operators';
import { neighborhoods } from '@imovi/db/schema';
import { estimateRepo } from '@imovi/db/estimates';
import { cityRepo } from '@imovi/db/cities';
import { estimateHeuristic } from '@imovi/ml-infer/heuristic';
import { getCfEnv } from '@/lib/cf-env';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/errors';
import {
  clientIp,
  consumeEstimateLimit,
  estimateLimit,
  verifyTurnstile,
  requiresProductionProtection,
} from '@/lib/estimate-protection';
import { publicEstimateOf } from '@/lib/public-estimate';


const RequestSchema = z.object({
  city: z.string().trim().min(1).max(120),
  state: z.string().length(2),
  neighborhood: z.string().trim().min(1).max(160),
  area: z.number().positive().max(100_000),
  propertyType: z.enum(['apartment', 'house', 'commercial', 'land']),
  bedrooms: z.number().int().min(0).max(20).optional(),
  bathrooms: z.number().int().min(0).max(20).optional(),
  parking: z.number().int().min(0).max(20).optional(),
  turnstileToken: z.string().max(2048).optional(),
});

export async function POST(req: Request): Promise<Response> {
  const cfEnv = await getCfEnv();
  const production = requiresProductionProtection(cfEnv);
  if (production && !cfEnv.TURNSTILE_SECRET) {
    return apiError(503, 'protection_unavailable', 'Verificação anti-bot indisponível.');
  }
  const ip = clientIp(req, production);
  if (!ip) return apiError(503, 'protection_unavailable', 'Proteção de acesso indisponível.');

  try {
    const db = getDb(cfEnv.DATABASE_URL);
    const rate = await consumeEstimateLimit(
      db,
      ip,
      estimateLimit(cfEnv.ESTIMATE_RATE_LIMIT_PER_MINUTE),
    );
    if (!rate.allowed) {
      return Response.json(
        {
          error: 'rate_limited',
          message: 'Limite de estimativas atingido. Tente novamente em um minuto.',
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rate.retryAfterSeconds), 'Cache-Control': 'no-store' },
        },
      );
    }
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return apiError(400, 'invalid_json', 'Body deve ser JSON válido.');
    }
    const parsed = RequestSchema.safeParse(json);
    if (!parsed.success)
      return apiError(400, 'invalid_request', 'Parâmetros inválidos.', parsed.error.flatten());
    const { turnstileToken, ...body } = parsed.data;
    if (
      cfEnv.TURNSTILE_SECRET &&
      !(await verifyTurnstile(cfEnv.TURNSTILE_SECRET, turnstileToken ?? '', ip))
    ) {
      return apiError(401, 'turnstile_failed', 'Verificação anti-bot falhou.');
    }
    const city = await cityRepo.findByNameState(db, body.city, body.state);
    if (!city?.active)
      return apiError(
        422,
        'out_of_coverage',
        `Cidade ${body.city}/${body.state} ainda não coberta.`,
      );

    const [hood] = await db
      .select({
        name: neighborhoods.name,
        medianPriceM2: neighborhoods.medianPriceM2,
        listingCount: neighborhoods.listingCount,
        lastAggregatedAt: neighborhoods.lastAggregatedAt,
        priceSource: neighborhoods.priceSource,
      })
      .from(neighborhoods)
      .where(
        and(
          eq(neighborhoods.city, body.city),
          eq(neighborhoods.state, body.state),
          eq(neighborhoods.name, body.neighborhood),
        ),
      )
      .limit(1);
    if (!hood)
      return apiError(404, 'neighborhood_not_found', 'Bairro não encontrado nesta cidade.');
    const priceM2 = Number(hood.medianPriceM2);
    if (!Number.isFinite(priceM2) || priceM2 <= 0)
      return apiError(503, 'no_price_data', 'Bairro sem referência de preço válida.');

    // ONNX remains disabled until the Cloudflare runtime is independently verified.
    const result = estimateHeuristic({
      neighborhoodPriceM2: priceM2,
      areaM2: body.area,
      propertyType: body.propertyType,
      bedrooms: body.bedrooms ?? null,
      bathrooms: body.bathrooms ?? null,
      parking: body.parking ?? null,
    });
    const sampleCount = Math.max(0, hood.listingCount ?? 0);
    const dataSource = {
      kind:
        hood.priceSource === 'observed_listings' && sampleCount >= 20
          ? 'listing_aggregate'
          : hood.priceSource === 'seed_reference'
            ? 'seed_reference'
            : 'insufficient_data',
      sampleCount,
      updatedAt: hood.lastAggregatedAt?.toISOString() ?? null,
    };
    const saved = await estimateRepo.record(db, {
      propertyId: null,
      inputPayload: body,
      estimate: result.estimate.toFixed(2),
      confidenceLow: result.confidenceLow.toFixed(2),
      confidenceHigh: result.confidenceHigh.toFixed(2),
      modelVersion: result.modelVersion,
      method: 'heuristic',
      featuresUsed: result.featuresUsed,
      comparablesIds: null,
      requestedBy: null,
      resultMetadata: {
        method: 'heuristic',
        neighborhood: { name: hood.name, medianPriceM2: priceM2 },
        dataSource,
        generatedAt: new Date().toISOString(),
      },
    });
    const response = publicEstimateOf(saved);
    if (!response) throw new Error('Invalid persisted estimate');
    return Response.json(response, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error('[api/estimate] estimate service unavailable');
    return apiError(
      503,
      'estimate_unavailable',
      'Serviço de estimativas indisponível. Tente novamente.',
    );
  }
}
