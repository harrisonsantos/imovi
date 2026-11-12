import { estimateRepo } from '@imovi/db/estimates';
import { getCfEnv } from '@/lib/cf-env';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/errors';
import { publicEstimateOf } from '@/lib/public-estimate';
import { requireSession, SessionError, sessionGuard } from '@/lib/session';

export async function GET(req: Request): Promise<Response> {
  try {
    const env = await getCfEnv();
    const session = await requireSession(req, env);
    const offset = Number(new URL(req.url).searchParams.get('offset') ?? '0');
    if (!Number.isSafeInteger(offset) || offset < 0)
      return apiError(400, 'invalid_pagination', 'Página inválida.');
    const rows = await estimateRepo.listByOwnerUserId(getDb(env.DATABASE_URL), session.userId, {
      limit: 50,
      offset,
    });
    return Response.json(
      {
        estimates: rows.map((row) => ({
          id: row.id,
          createdAt: row.createdAt,
          input: row.inputPayload,
          result: publicEstimateOf(row),
        })),
        nextOffset: rows.length === 50 ? offset + rows.length : null,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof SessionError) return sessionGuard(error);
    return apiError(503, 'history_unavailable', 'Não foi possível carregar suas estimativas.');
  }
}
