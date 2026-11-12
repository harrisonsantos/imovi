/**
 * P0 de confiança: a copy pública só anuncia o que está entregue e ligado a
 * direitos reais. Componentes são renderizados como HTML estático.
 */
import './helpers/react-global';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BILLING_PLANS } from '../src/lib/billing';
import PrecosPage from '../src/app/precos/page';
import AssinaturaPage from '../src/app/auditoria/assinatura/page';
import { metadata as precosMetadata } from '../src/app/precos/layout';
import DashboardPage from '../src/app/dashboard/page';
import { metadata as dashboardMetadata } from '../src/app/dashboard/layout';
import MetodologiaPage from '../src/app/metodologia/page';
import sitemap from '../src/app/sitemap';
import { Hero } from '../src/components/Hero';
import { FAQ, FAQ_ITEMS } from '../src/components/FAQ';
import HomePage from '../src/app/page';
import { DataViz } from '../src/components/DataViz';
import { Nav } from '../src/components/Nav';
import { Footer } from '../src/components/Footer';

function html(component: ComponentType): string {
  return renderToStaticMarkup(createElement(component));
}
function text(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ') // o \s abaixo já cobre o NBSP literal
    .replace(/\s+/g, ' ');
}
/** Remove a seção "Em breve" para verificar o que é vendido como entregue. */
function withoutComingSoon(markup: string): string {
  return markup.replace(/<section[^>]*id="em-breve"[\s\S]*?<\/section>/, '');
}

const FUTURE_FEATURES = /PDF|\bAPI\b|comparáve|histórico|ilimitad/i;

describe('/auditoria/assinatura respeita os planos públicos', () => {
  it('não promete corretores ilimitados e usa preços e limites do servidor', () => {
    const page = text(html(AssinaturaPage));
    expect(page).not.toMatch(/ilimitad/i);
    expect(JSON.stringify(BILLING_PLANS)).not.toMatch(/ilimitad/i);
    for (const plan of BILLING_PLANS) {
      expect(page).toContain(plan.name);
      expect(page).toContain(`R$ ${plan.priceMonthly} /mês`);
      expect(page).toContain(
        plan.maxCorretores === null
          ? 'Acima de 15 corretores'
          : `Até ${plan.maxCorretores} corretores`,
      );
    }
  });
});

describe('/precos vende apenas o que está entregue', () => {
  const page = html(PrecosPage);

  it('não usa "ilimitado" em nenhum plano', () => {
    expect(text(page)).not.toMatch(/ilimitad/i);
  });

  it('mantém os três planos da auditoria com preço e limite do servidor', () => {
    for (const plan of BILLING_PLANS) {
      expect(text(page)).toContain(`R$ ${plan.priceMonthly}/mês`);
      expect(page).toContain(`/auditoria/cadastro?plan=${plan.id}`);
      if (plan.maxCorretores) expect(text(page)).toContain(`Até ${plan.maxCorretores} corretores`);
    }
    expect(text(page)).toContain('Acima de 15 corretores');
  });

  it('descreve somente recursos entregues da auditoria', () => {
    const delivered = text(withoutComingSoon(page));
    expect(delivered).toContain('Vista CRM');
    expect(delivered).toContain('14 dias');
    expect(delivered).toMatch(/exporta[çc][ãa]o em CSV/i);
    expect(delivered).not.toMatch(FUTURE_FEATURES);
  });

  it('marca recursos futuros como "Em breve" e liga à lista de espera', () => {
    const soon = page.match(/<section[^>]*id="em-breve"[\s\S]*?<\/section>/)?.[0] ?? '';
    expect(soon).not.toBe('');
    expect(text(soon)).toContain('Em breve');
    expect(text(soon)).toMatch(/PDF/);
    expect(text(soon)).toMatch(/API/);
    expect(text(soon)).toMatch(/comparáveis/i);
    expect(text(soon)).toMatch(/sem data/i);
    expect(soon).toContain('href="#waitlist"');
  });

  it('não promete relatórios ou API nos metadados de busca', () => {
    const meta = JSON.stringify(precosMetadata);
    expect(meta).not.toMatch(/\bAPI\b|relatório/i);
  });
});

describe('/dashboard não exibe demonstração fictícia', () => {
  it('redireciona para a auditoria autenticada', () => {
    let digest = '';
    try {
      DashboardPage();
    } catch (err) {
      digest = String((err as { digest?: string }).digest ?? '');
    }
    expect(digest).toContain('NEXT_REDIRECT');
    expect(digest).toContain('/auditoria');
  });

  it('não é indexado nem linkado na navegação pública ou no sitemap', async () => {
    expect(dashboardMetadata.robots).toMatchObject({ index: false, follow: false });
    expect(JSON.stringify(dashboardMetadata)).not.toMatch(/Demonstra/i);
    expect(html(Nav)).not.toContain('/dashboard');
    expect(html(Footer)).not.toContain('/dashboard');
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((entry) => entry.url.endsWith('/precos/'))).toBe(true);
    expect(JSON.stringify(entries)).not.toContain('/dashboard');
  });
});

describe('Hero, FAQ e metodologia sem promessas não entregues', () => {
  it('Hero rotula a demonstração e não atribui valores fictícios a portais reais', () => {
    const hero = text(html(Hero));
    expect(hero).toContain('Demonstração com valores fictícios');
    expect(hero).not.toMatch(/Zap|OLX|VivaReal|dados agregados/i);
    expect(hero).not.toMatch(/Avaliação automática/i);
    expect(hero).toContain('±30%');
  });

  it('DataViz não cita portais como fonte de dados fictícios', () => {
    const viz = text(html(DataViz));
    expect(viz).toContain('Demonstração com dados fictícios');
    expect(viz).not.toMatch(/Fontes?:|Zap|OLX|VivaReal/i);
  });

  it('FAQ não promete cidades futuras nem precisão e indica quem emite laudo', () => {
    // FAQ é um acordeão: as respostas fechadas não vão para o HTML inicial.
    expect(text(html(FAQ))).toMatch(/Quais cidades/);
    const faq = FAQ_ITEMS.map(([q, a]) => `${q} ${a}`).join(' ');
    expect(faq).not.toMatch(/roadmap|ilimitad|inteligência de preço|São Paulo/i);
    expect(faq).toMatch(/cidades e bairros disponíveis aparecem no formulário/i);
    expect(faq).toMatch(/NBR 14653/);
    expect(faq).not.toMatch(/CRECI continua/);
  });

  it('dados estruturados da home não prometem avaliação de mercado nacional', () => {
    const home = html(HomePage);
    expect(home).not.toMatch(/valor de mercado de imóveis no Brasil|Avaliador de imóveis/);
    expect(home).toMatch(/Estimativa heurística/);
  });

  it('metodologia declara limitações e não apresenta comparáveis', () => {
    const page = text(html(MetodologiaPage));
    expect(page).toContain('±30%');
    expect(page).toMatch(/não é um intervalo estatístico/i);
    expect(page).toMatch(/Comparáveis, preços de vendas e históricos não são apresentados/);
  });
});
