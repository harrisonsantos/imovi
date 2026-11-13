import { rateLimitRepo } from '@imovi/db/rate-limit';
import type { getDb } from './db';

export function requiresProductionProtection(env: Record<string, string>): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    env.NODE_ENV === 'production' ||
    env.NEXT_PUBLIC_APP_ENV === 'production' ||
    env.NEXT_PUBLIC_APP_ENV === 'preview'
  );
}

export function estimateLimit(value?: string): number {
  const parsed = Number(value ?? 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 1000 ? parsed : 10;
}

export function clientIp(req: Request, production: boolean): string | null {
  const ip = req.headers.get('cf-connecting-ip')?.trim();
  if (ip && ip.length <= 64 && /^[\da-fA-F:.]+$/.test(ip)) return ip;
  return production ? null : 'local-development';
}

export async function consumeEstimateLimit(
  db: ReturnType<typeof getDb>,
  ip: string,
  limit: number,
  now = Date.now(),
  namespace = 'estimate',
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${namespace}:${ip}`),
  );
  const key = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
  const windowStart = new Date(Math.floor(now / 60_000) * 60_000);
  return rateLimitRepo.consume(db, key, windowStart, limit, new Date(now));
}

export async function verifyTurnstile(secret: string, token: string, ip: string): Promise<boolean> {
  if (!secret || !token) return false;
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
