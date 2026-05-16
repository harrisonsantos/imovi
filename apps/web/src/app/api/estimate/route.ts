/**
 * POST /api/estimate — estima o valor de um imóvel em Curitiba/PR.
 *
 * Ordem de fallback:
 *   1. Modelo ONNX v1+ carregado do R2 `MODEL_ARTIFACTS` (quando disponível)
 *   2. Heurística determinística baseada em mediana do bairro
 *
 * Cobertura: apenas Curitiba/PR. Outras cidades retornam 422.
 */
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { neighborhoods } from '@imovi/db/schema';
import { estimateRepo } from '@imovi/db/estimates';
// Subpath evita puxar load.ts (que importa onnxruntime-node) pro bundle edge.
import { estimateHeuristic } from '@imovi/ml-infer/heuristic';
import { getDb } from '@/lib/db';
import { getCfEnv } from '@/lib/cf-env';
import { apiError } from '@/lib/errors';
import { tryEstimateWithModel, type R2ModelBindings } from '@/lib/model';

export const runtime = 'edge';

/**
 * Valida token do Cloudflare Turnstile.
 * Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return true; // guard — caller deve ter checado, mas por segurança.
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

// Flag para logar o warning de Turnstile ausente apenas 1x por worker instance.
let warnedMissingTurnstile = false;

const EstimateRequestSchema = z.object({
  city: z.string().min(1),
  state: z.string().length(2),
  neighborhood: z.string().min(1),
  area: z.number().positive().max(100_000),
  propertyType: z.enum(['apartment', 'house', 'commercial', 'land']),
  bedrooms: z.number().int().min(0).max(20).optional(),
  bathrooms: z.number().int().min(0).max(20).optional(),
  parking: z.number().int().min(0).max(20).optional(),
  turnstileToken: z.string().optional(),
});

export async function POST(req: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Body deve ser JSON válido.');
  }

  const parsed = EstimateRequestSchema.safeParse(json);
  if (!parsed.success) {
    return apiError(400, 'invalid_request', 'Parâmetros inválidos.', parsed.error.flatten());
  }
  const body = parsed.data;

  // Validação Turnstile. Pulada em dev local (TURNSTILE_SECRET ausente).
  const turnstileSecret = process.env.TURNSTILE_SECRET;
  if (turnstileSecret) {
    if (!body.turnstileToken) {
      return apiError(401, 'turnstile_failed', 'Verificação anti-bot falhou');
    }
    const ip = req.headers.get('cf-connecting-ip') ?? 'unknown';
    const ok = await verifyTurnstile(body.turnstileToken, ip);
    if (!ok) {
      return apiError(401, 'turnstile_failed', 'Verificação anti-bot falhou');
    }
  } else if (!warnedMissingTurnstile) {
    warnedMissingTurnstile = true;
    // eslint-disable-next-line no-console
    console.warn('[api/estimate] TURNSTILE_SECRET ausente — validação anti-bot desabilitada (dev).');
  }

  // MVP cobre apenas Curitiba/PR.
  if (body.city !== 'Curitiba' || body.state !== 'PR') {
    return apiError(422, 'out_of_coverage', 'MVP cobre apenas Curitiba/PR.');
  }

  const cfEnv = await getCfEnv();

  let db;
  try {
    db = getDb(cfEnv.DATABASE_URL);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/estimate] db init falhou:', err);
    return apiError(503, 'db_unavailable', 'Serviço de dados indisponível.');
  }

  const [hood] = await db
    .select({
      id: neighborhoods.id,
      name: neighborhoods.name,
      medianPriceM2: neighborhoods.medianPriceM2,
    })
    .from(neighborhoods)
    .where(
      and(
        eq(neighborhoods.city, 'Curitiba'),
        eq(neighborhoods.state, 'PR'),
        eq(neighborhoods.name, body.neighborhood),
      ),
    )
    .limit(1);

  if (!hood) {
    // Sugere top 5 bairros por nome como fallback amigável.
    const suggestions = await db
      .select({ name: neighborhoods.name })
      .from(neighborhoods)
      .where(and(eq(neighborhoods.city, 'Curitiba'), eq(neighborhoods.state, 'PR')))
      .orderBy(neighborhoods.name)
      .limit(5);
    return Response.json(
      {
        error: 'neighborhood_not_found',
        message: `Bairro "${body.neighborhood}" não encontrado em Curitiba/PR.`,
        suggestions: suggestions.map((s) => s.name),
      },
      { status: 404 },
    );
  }

  if (hood.medianPriceM2 === null) {
    return apiError(503, 'no_price_data', 'Bairro sem dados de preço agregados.');
  }

  const priceM2 = Number(hood.medianPriceM2);
  if (!Number.isFinite(priceM2) || priceM2 <= 0) {
    return apiError(503, 'no_price_data', 'Mediana de preço inválida para este bairro.');
  }

  // Tenta modelo ONNX do R2; fallback silencioso pra heurística se:
  //   - bucket MODEL_ARTIFACTS não bindado (preview sem R2)
  //   - objeto `current/model.onnx` ausente (ainda não treinamos)
  //   - erro no runtime WASM
  let modelResult: Awaited<ReturnType<typeof tryEstimateWithModel>> = null;
  try {
    modelResult = await tryEstimateWithModel(cfEnv as unknown as R2ModelBindings, {
      area: body.area,
      bedrooms: body.bedrooms ?? null,
      bathrooms: body.bathrooms ?? null,
      parking: body.parking ?? null,
      propertyType: body.propertyType,
    });
  } catch {
    modelResult = null;
  }

  const result =
    modelResult ??
    estimateHeuristic({
      neighborhoodPriceM2: priceM2,
      areaM2: body.area,
      bedrooms: body.bedrooms ?? null,
      bathrooms: body.bathrooms ?? null,
      parking: body.parking ?? null,
      propertyType: body.propertyType,
    });

  // Auditoria — grava request + output. Não bloqueia resposta em caso de falha.
  try {
    await estimateRepo.record(db, {
      propertyId: null,
      inputPayload: body,
      estimate: result.estimate.toFixed(2),
      confidenceLow: result.confidenceLow.toFixed(2),
      confidenceHigh: result.confidenceHigh.toFixed(2),
      modelVersion: result.modelVersion,
      featuresUsed: result.featuresUsed,
      comparablesIds: null,
      requestedBy: null,
    });
  } catch (err) {
    // Log mas não falha a request — estimativa é o que importa.
    // eslint-disable-next-line no-console
    console.error('[api/estimate] falha ao gravar auditoria:', err);
  }

  return Response.json({
    estimate: result.estimate,
    confidenceLow: result.confidenceLow,
    confidenceHigh: result.confidenceHigh,
    modelVersion: result.modelVersion,
    featuresUsed: result.featuresUsed,
    neighborhood: {
      name: hood.name,
      medianPriceM2: priceM2,
    },
  });
}
