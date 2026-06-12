'use client';

/**
 * Layout do módulo de auditoria.
 *
 * Rotas públicas (/auditoria/login e /auditoria/cadastro) renderizam sem
 * shell. As demais exigem sessão: no mount consultamos /api/auth/get-session
 * e redirecionamos para o login quando não há sessão. O shell traz a sidebar
 * de navegação (estilo do dashboard imovi), o nome da org no header e o badge
 * de anomalias abertas, atualizado a cada 60s via /api/auditoria/metrics.
 */

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { tokens as C } from '@/lib/tokens';

const PUBLIC_PATHS = ['/auditoria/login', '/auditoria/cadastro'];

const NAV_ITEMS = [
  { href: '/auditoria', label: 'Visão geral' },
  { href: '/auditoria/anomalias', label: 'Anomalias' },
  { href: '/auditoria/negocios', label: 'Negócios' },
  { href: '/auditoria/leads', label: 'Leads' },
  { href: '/auditoria/corretores', label: 'Corretores' },
  { href: '/auditoria/configuracao', label: 'Configuração' },
] as const;

interface SessionUser {
  email: string;
  name?: string;
}

interface MetricsResponse {
  org?: { id: string; name: string };
  anomalias?: { naoResolvidas?: { total?: number } };
}

function AuditoriaShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [openCount, setOpenCount] = useState<number | null>(null);

  // Gate de sessão: sem sessão → login.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/get-session');
        const data = (await res.json().catch(() => null)) as { user?: SessionUser } | null;
        if (!active) return;
        if (!res.ok || !data?.user) {
          router.replace('/auditoria/login');
          return;
        }
        setUser(data.user);
        setChecked(true);
      } catch {
        if (active) router.replace('/auditoria/login');
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);

  // Badge de anomalias abertas + nome da org (poll a cada 60s).
  const loadMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/auditoria/metrics');
      if (!res.ok) return;
      const data = (await res.json()) as MetricsResponse;
      setOrgName(data.org?.name ?? null);
      setOpenCount(data.anomalias?.naoResolvidas?.total ?? 0);
    } catch {
      // silencioso — o badge simplesmente não atualiza.
    }
  }, []);

  useEffect(() => {
    if (!checked) return;
    void loadMetrics();
    const id = setInterval(() => void loadMetrics(), 60_000);
    return () => clearInterval(id);
  }, [checked, loadMetrics]);

  async function handleSignOut() {
    try {
      await fetch('/api/auth/sign-out', { method: 'POST' });
    } catch {
      // mesmo com falha de rede seguimos para a home.
    }
    window.location.href = '/';
  }

  if (!checked) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: C.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p style={{ color: C.text2, fontSize: '0.875rem' }}>Carregando…</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: C.bg, overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: '230px',
          flexShrink: 0,
          background: C.surface,
          borderRight: `1px solid ${C.border}`,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${C.border}` }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '9px', textDecoration: 'none' }}>
            <svg width="22" height="19" viewBox="0 0 28 24" fill="none">
              <rect x="0" y="16" width="7" height="8" rx="1.5" fill={C.accent} />
              <rect x="10.5" y="10" width="7" height="14" rx="1.5" fill={C.accent} fillOpacity=".6" />
              <rect x="21" y="4" width="7" height="20" rx="1.5" fill={C.accent} fillOpacity=".3" />
              <polyline
                points="3.5,16 14,10 24.5,4"
                stroke={C.accent}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeOpacity=".55"
                fill="none"
              />
            </svg>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '19px',
                color: C.text,
                letterSpacing: '-0.04em',
              }}
            >
              imovi
            </span>
            <span
              style={{
                fontSize: '0.5875rem',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: C.accent,
                border: `1px solid ${C.accentMid}`,
                borderRadius: '4px',
                padding: '1px 5px',
              }}
            >
              auditoria
            </span>
          </Link>
        </div>

        <nav
          style={{
            flex: 1,
            padding: '1rem 0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            overflowY: 'auto',
          }}
        >
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === '/auditoria' ? pathname === '/auditoria' : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '9px',
                  padding: '0.5625rem 0.75rem',
                  background: active ? C.accentDim : 'transparent',
                  border: `1px solid ${active ? C.accentMid : 'transparent'}`,
                  borderRadius: '7px',
                  color: active ? C.accent : C.text2,
                  fontSize: '0.875rem',
                  fontWeight: active ? 600 : 400,
                  fontFamily: 'var(--font-body)',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                }}
              >
                <span>{item.label}</span>
                {item.label === 'Anomalias' && openCount !== null && openCount > 0 && (
                  <span
                    style={{
                      minWidth: '18px',
                      padding: '1px 6px',
                      borderRadius: '9px',
                      background: 'rgba(248,113,113,0.12)',
                      border: '1px solid rgba(248,113,113,0.3)',
                      color: C.negative,
                      fontSize: '0.625rem',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      textAlign: 'center',
                    }}
                  >
                    {openCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '0.75rem', borderTop: `1px solid ${C.border}` }}>
          <div
            style={{
              padding: '0.75rem',
              background: C.surface2,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
            }}
          >
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                background: C.accentDim,
                border: `1px solid ${C.accentMid}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: C.accent }}>
                {(user?.email ?? '?').charAt(0).toUpperCase()}
              </span>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: C.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user?.email}
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              style={{
                padding: '0.25rem 0.5rem',
                background: 'transparent',
                border: `1px solid ${C.border}`,
                borderRadius: '6px',
                color: C.text2,
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Sair
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header
          style={{
            height: '56px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1.5rem',
            borderBottom: `1px solid ${C.border}`,
            flexShrink: 0,
          }}
        >
          <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: C.text, margin: 0 }}>
            {orgName ?? 'Auditoria de vendas'}
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              background: C.surface2,
              border: `1px solid ${C.border}`,
              borderRadius: '7px',
            }}
          >
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.accent }} />
            <span style={{ fontSize: '0.625rem', fontFamily: 'var(--font-mono)', color: C.text2 }}>
              auditoria contínua
            </span>
          </div>
        </header>
        <div style={{ flex: 1, overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}

export default function AuditoriaLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.some((p) => pathname?.startsWith(p));
  if (isPublic) return <>{children}</>;
  return <AuditoriaShell>{children}</AuditoriaShell>;
}
