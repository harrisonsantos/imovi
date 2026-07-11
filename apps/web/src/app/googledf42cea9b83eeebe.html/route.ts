export const runtime = "edge";

export function GET() {
  return new Response(
    "google-site-verification: googledf42cea9b83eeebe.html\n",
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );
}
