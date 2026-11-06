// Read-only functional smoke. No estimates, accounts or billing are created.
const web = process.env.WEB_URL?.replace(/\/$/, '');
const worker = process.env.WORKER_URL?.replace(/\/$/, '');
if (!web || !worker) throw new Error('WEB_URL and WORKER_URL are required');
for (const [base, path, check] of [
  [web, '/api/health/', (body) => body.status === 'ok'],
  [web, '/api/ready/', (body) => body.status === 'ready'],
  [web, '/api/cities/', (body) => Array.isArray(body.cities) && body.cities.length > 0],
  [worker, '/health', (body) => body.status === 'ok'],
  [worker, '/ready', (body) => body.status === 'ready'],
]) {
  const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok || !check(await response.json())) throw new Error(`Smoke failed: ${path}`);
  console.log(`PASS ${path}`);
}
