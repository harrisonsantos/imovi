/**
 * GET /api/neighborhoods?city=Curitiba&state=PR
 *
 * Lista bairros disponíveis ordenados por nome. Cacheado por 1h na CDN
 * — mediana de preço muda no máximo diariamente.
 */
import { and, eq, asc } from 'drizzle-orm';
import { neighborhoods } from '@imovi/db/schema';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/errors';

export const runtime = 'edge';

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const city = url.searchParams.get('city') ?? 'Curitiba';
  const state = url.searchParams.get('state') ?? 'PR';

  if (city !== 'Curitiba' || state !== 'PR') {
    return apiError(422, 'out_of_coverage', 'MVP cobre apenas Curitiba/PR.');
  }

  let db;
  try {
    db = getDb();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/neighborhoods] db init falhou:', err);
    return apiError(503, 'db_unavailable', 'Serviço de dados indisponível.');
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
    // eslint-disable-next-line no-console
    console.error('[api/neighborhoods] query falhou:', err);
    return apiError(503, 'db_error', 'Erro ao consultar bairros.');
  }
}
