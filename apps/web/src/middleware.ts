import { NextResponse, type NextRequest } from 'next/server';
import { apiError } from '@/lib/errors';

/** Enforce the product boundary before rendering any audit page, including its public shell. */
export async function middleware(req: NextRequest) {
  if (!req.headers.has('cookie')) return NextResponse.next();
  try {
    // Keep auth/DB in the Node route: OpenNext's standard middleware is an edge bundle.
    const response = await fetch(new URL('/api/me/entitlements', req.url), {
      headers: { cookie: req.headers.get('cookie')! },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok)
      return apiError(503, 'auth_unavailable', 'Não foi possível verificar seu acesso.');
    const rights = (await response.json()) as { authenticated: boolean; product: string | null };
    if (rights.authenticated && rights.product === 'corretor_pro') {
      return apiError(403, 'product_required', 'Seu plano não inclui este produto.');
    }
    return NextResponse.next();
  } catch {
    return apiError(503, 'auth_unavailable', 'Não foi possível verificar seu acesso.');
  }
}

export const config = {
  matcher: ['/auditoria/:path*', '/api/auditoria/:path*'],
};
