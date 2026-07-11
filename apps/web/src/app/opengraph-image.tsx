import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'imovi — descubra quanto vale seu imóvel';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 72,
        color: '#f4f7f9',
        background:
          'radial-gradient(circle at 80% 15%, rgba(0,217,126,.28), transparent 36%), #07090e',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div style={{ display: 'flex', color: '#00d97e', fontSize: 34, fontWeight: 700 }}>imovi.</div>
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 920 }}>
        <div style={{ fontSize: 70, lineHeight: 1.06, fontWeight: 800, letterSpacing: -3 }}>
          Quanto vale o seu imóvel?
        </div>
        <div style={{ marginTop: 24, color: '#a7b3bd', fontSize: 30, lineHeight: 1.35 }}>
          Estimativa gratuita baseada em dados reais de preço por m².
        </div>
      </div>
      <div style={{ display: 'flex', color: '#6f7d88', fontSize: 23 }}>imovi.app.br</div>
    </div>,
    size,
  );
}
