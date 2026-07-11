/**
 * GET /api/neighborhoods?city=Curitiba&state=PR
 *
 * Lista bairros disponíveis ordenados por nome. Cacheado por 1h na CDN
 * — mediana de preço muda no máximo diariamente.
 */
import { and, eq, asc } from '@imovi/db/operators';
import { neighborhoods } from '@imovi/db/schema';
import { cityRepo } from '@imovi/db/cities';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/errors';

export const runtime = 'edge';

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const city = url.searchParams.get('city') ?? 'Curitiba';
  const state = url.searchParams.get('state') ?? 'PR';

  let db;
  try {
    const { getRequestContext } = await import('@cloudflare/next-on-pages');
    const env = getRequestContext().env as Record<string, string>;
    db = getDb(env.DATABASE_URL);
  } catch (err) {
     
    console.error('[api/neighborhoods] db init falhou:', err);
    return apiError(503, 'db_unavailable', 'Serviço de dados indisponível.');
  }

  // Cobertura dinâmica — cidade precisa existir e estar ativa em `cities`.
  const coveredCity = await cityRepo.findByNameState(db, city, state);
  if (!coveredCity || !coveredCity.active) {
    return apiError(422, 'out_of_coverage', `Cidade ${city}/${state} ainda não coberta.`);
  }

  try {
    const rows = await db
      .select({
        name: neighborhoods.name,
        medianPriceM2: neighborhoods.medianPriceM2,
      })
      .from(neighborhoods)
      .where(and(eq(neighborhoods.city, city), eq(neighborhoods.state, state)))
      .orderBy(asc(neighborhoods.name));

    const payload = rows.map((r) => ({
      name: r.name,
      medianPriceM2: r.medianPriceM2 !== null ? Number(r.medianPriceM2) : null,
    }));

    return Response.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
      },
    });
  } catch (err) {
     
    console.error('[api/neighborhoods] query falhou:', err);
    return apiError(503, 'db_error', 'Erro ao consultar bairros.');
  }
}
