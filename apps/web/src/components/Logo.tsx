import Link from 'next/link';
import { tokens as C } from '@/lib/tokens';

interface LogoProps {
  size?: number;
  accent?: string;
  href?: string;
}

export function Logo({ size = 26, accent = C.accent, href = '/' }: LogoProps) {
  return (
    <Link
      href={href}
      style={{ display: 'flex', alignItems: 'center', gap: '9px',
               textDecoration: 'none', userSelect: 'none', flexShrink: 0 }}
    >
      <svg width={size} height={Math.round(size * 0.857)} viewBox="0 0 28 24" fill="none">
        <rect x="0"    y="16" width="7" height="8"  rx="1.5" fill={accent} />
        <rect x="10.5" y="10" width="7" height="14" rx="1.5" fill={accent} fillOpacity=".6" />
        <rect x="21"   y="4"  width="7" height="20" rx="1.5" fill={accent} fillOpacity=".3" />
        <polyline
          points="3.5,16 14,10 24.5,4"
          stroke={accent} strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round"
          strokeOpacity=".55" fill="none"
        />
      </svg>
      <span style={{
        fontFamily:    'var(--font-display)',
        fontWeight:    700,
        fontSize:      size * 0.88 + 'px',
        color:         C.text,
        letterSpacing: '-0.04em',
      }}>
        imovi
      </span>
    </Link>
  );
}
