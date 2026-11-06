// Recovery is an explicit operation. Default only counts retryable events.
// Run with --apply in authorized staging; production requires separate approval.
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
const require = createRequire(new URL('../packages/db/package.json', import.meta.url));
const { neon } = require('@neondatabase/serverless');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`SELECT payload FROM billing_events
  WHERE payload IS NOT NULL AND (status = 'pending' OR (status = 'processing' AND lease_expires_at < now()))
  ORDER BY id LIMIT 100`;
console.log(`Retryable inbox events (batch <=100): ${rows.length}`);
if (process.argv.includes('--apply')) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const origin = process.env.WEB_URL;
  if (!secret || !origin || new URL(origin).protocol !== 'https:') {
    throw new Error('HTTPS WEB_URL and STRIPE_WEBHOOK_SECRET required');
  }
  let recovered = 0;
  for (const row of rows) {
    const payload = JSON.stringify(row.payload);
    const ts = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', secret).update(`${ts}.${payload}`).digest('hex');
    const response = await fetch(new URL('/api/billing/webhook/', origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': `t=${ts},v1=${signature}`,
      },
      body: payload,
      signal: AbortSignal.timeout(45_000),
      redirect: 'error',
    });
    if (!response.ok)
      throw new Error(`Recovery stopped: HTTP ${response.status}; remaining events retained`);
    recovered++;
  }
  console.log(`Recovered ${recovered} events`);
}
