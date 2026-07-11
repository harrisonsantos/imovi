import { getCfEnv } from '@/lib/cf-env';

export const runtime = 'edge';

export async function GET(): Promise<Response> {
  const cfEnv = await getCfEnv();
  const client = cfEnv.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  if (!client?.startsWith('ca-pub-')) {
    return new Response('AdSense não configurado.\n', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  const publisher = client.replace(/^ca-/, '');
  return new Response(`google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
