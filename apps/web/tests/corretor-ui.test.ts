import './helpers/react-global';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ rights: null as unknown, values: [] as unknown[] }));
vi.mock('@/lib/use-entitlements', () => ({ useEntitlements: () => state.rights }));
vi.mock('react', async (original) => ({
  ...(await original<object>()),
  // Render hydrated snapshots: the first AdSlot state represents stored consent.
  useState: (initial: unknown) => [state.values.length ? state.values.shift() : initial, vi.fn()],
}));
import { AdSlot } from '../src/components/ads/AdSlot';
import { EstimateForm } from '../src/components/EstimateForm';
import HistoryPage from '../src/app/conta/estimativas/page';

beforeEach(() => {
  state.rights = {
    authenticated: true,
    ads: false,
    history: true,
    quota: { limit: 100, used: 0, remaining: 100 },
  };
  state.values = [];
  vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT_ID', 'ca-pub-fixture');
  vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'fixture-site');
});
afterEach(() => vi.unstubAllEnvs());
function ad(consented: boolean, adsEnabled?: boolean) {
  state.values = [consented, false];
  return renderToStaticMarkup(createElement(AdSlot, { slot: 'fixture-slot', adsEnabled }));
}
describe('Corretor Pro UI', () => {
  it('never renders an ad for Pro, even with saved ad consent (AC-P4)', () => {
    expect(ad(true)).toBe('');
    expect(ad(true, false)).toBe('');
  });
  it('shows an anonymous ad only after consent and entitlement resolution', () => {
    state.rights = null;
    expect(ad(true)).toBe('');
    state.rights = { authenticated: false, ads: true };
    expect(ad(false)).toBe('');
    expect(ad(true)).toContain('Publicidade');
  });
  it('does not render Turnstile for Pro, even when the monthly quota is exhausted', () => {
    state.rights = {
      authenticated: true,
      ads: false,
      quota: { limit: 100, used: 100, remaining: 0 },
    };
    expect(
      renderToStaticMarkup(
        createElement<{ siteKey?: string }>(EstimateForm, { siteKey: 'fixture' }),
      ),
    ).not.toContain('cf-turnstile');
    state.rights = { authenticated: false, ads: true, quota: null };
    expect(
      renderToStaticMarkup(
        createElement<{ siteKey?: string }>(EstimateForm, { siteKey: 'fixture' }),
      ),
    ).toContain('cf-turnstile');
  });
  it('history states the heuristic limits without implying statistical confidence (AC-P5)', () => {
    const html = renderToStaticMarkup(createElement(HistoryPage));
    expect(html).toContain('±30%');
    expect(html).toContain('heurísticas');
    expect(html).toContain('não é um intervalo estatístico');
  });
});
