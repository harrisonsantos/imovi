import './helpers/react-global';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
import CadastroPage from '../src/app/conta/cadastro/page';
import LoginPage from '../src/app/conta/login/page';
import { buildSignupBody } from '../src/lib/cadastro';

describe('individual Corretor Pro onboarding', () => {
  it('offers individual registration with terms and a Pro login destination', () => {
    const html = renderToStaticMarkup(createElement(CadastroPage));
    expect(html).toContain('Corretor Pro');
    expect(html).toContain('Termos de uso');
    expect(html).toContain('/conta/login');
    expect(html).not.toContain('Nome da imobiliária');
    expect(html).not.toContain('14 dias grátis');
  });
  it('offers account login and sends email confirmation back to the same product', () => {
    const html = renderToStaticMarkup(createElement(LoginPage));
    expect(html).toContain('Corretor Pro');
    expect(html).toContain('/conta/cadastro');
    expect(
      buildSignupBody(
        { name: 'Ana', email: 'ana@example.test', password: 'fixture-password' },
        'corretor_pro',
      ).callbackURL,
    ).toBe('/conta/login?verified=1');
  });
});
