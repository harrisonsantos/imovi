import { z } from 'zod';
import { estimateRepo } from '@imovi/db/estimates';
import { getCfEnv } from '@/lib/cf-env';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/errors';
import { publicEstimateOf } from '@/lib/public-estimate';

export const runtime = 'edge';

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success)
    return apiError(400, 'invalid_reference', 'Referência inválida.');
  try {
    const env = await getCfEnv();
    const saved = await estimateRepo.findById(getDb(env.DATABASE_URL), id);
    const result = saved ? publicEstimateOf(saved) : null;
    if (!result)
      return apiError(
        404,
        'estimate_not_found',
        'Estimativa não encontrada. Gere uma nova estimativa.',
      );
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return apiError(
      503,
      'estimate_unavailable',
      'Não foi possível recuperar a estimativa. Tente novamente.',
    );
  }
}
