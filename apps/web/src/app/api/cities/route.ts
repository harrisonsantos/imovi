/**
 * GET /api/cities
 *
 * Lista cidades ativas (cobertas) ordenadas por nome. Cacheado por 1h na CDN
 * — cobertura muda raramente.
 */
import { cityRepo } from '@imovi/db/cities';
import { getCfEnv } from '@/lib/cf-env';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/errors';

export const runtime = 'edge';

export async function GET(): Promise<Response> {
  let db;
  try {
    const env = await getCfEnv();
    db = getDb(env.DATABASE_URL);
  } catch (err) {
     
    console.error('[api/cities] db init falhou:', err);
    return apiError(503, 'db_unavailable', 'Serviço de dados indisponível.');
  }

  try {
    const rows = await cityRepo.listActive(db);
    const cities = rows
      .map((c) => ({ name: c.name, state: c.state, slug: c.slug }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    return Response.json(
      { cities },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
        },
      },
    );
  } catch (err) {
     
    console.error('[api/cities] query falhou:', err);
    return apiError(503, 'db_error', 'Erro ao consultar cidades.');
  }
}
