'use client';

import { useState } from 'react';
import { tokens as C } from '@/lib/tokens';

const FAQS: [string, string][] = [
  ['O imovi substitui um avaliador profissional?', 'O imovi é uma ferramenta de inteligência de preço para orientações de compra, venda e precificação. Para laudos com validade jurídica, um avaliador credenciado pelo CRECI continua sendo necessário.'],
  ['De onde vêm os dados?', 'Agregamos anúncios do Zap Imóveis, OLX e VivaReal, enriquecidos com dados de IPTU e geolocalização. A base é atualizada diariamente por scrapers automatizados.'],
  ['Qual é a precisão do modelo?', 'O modelo apresenta precisão de ±15% em bairros com alto volume de transações. O intervalo de confiança é sempre exibido na estimativa para total transparência.'],
  ['O serviço é realmente gratuito?', 'Sim. Estimativas são gratuitas. Planos profissionais com relatórios detalhados, API e integrações estão disponíveis para quem precisa de mais volume ou automação.'],
  ['Quais cidades são cobertas?', 'Estamos expandindo continuamente. São Paulo, Porto Alegre e Florianópolis estão no roadmap. Novas cidades são anunciadas conforme a base de dados atinge cobertura suficiente.'],
  ['Meus dados ficam armazenados?', 'Consultas são anônimas. Não armazenamos dados pessoais — os parâmetros do imóvel são usados apenas para o cálculo e descartados em seguida.'],
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section style={{ padding: 'clamp(4rem,8vh,5.5rem) clamp(1rem,4vw,2.5rem)' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <p style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.14em', color: C.accent, marginBottom: '0.75rem' }}>
          Dúvidas frequentes
        </p>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(1.75rem,3vw,2.375rem)', letterSpacing: '-0.03em', marginBottom: '2rem' }}>
          FAQ
        </h2>
        {FAQS.map(([q, a], i) => (
          <div key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.125rem 0', background: 'none', border: 'none', cursor: 'pointer', color: C.text, fontSize: '0.9375rem', fontWeight: 500, fontFamily: 'var(--font-body)', textAlign: 'left', gap: '1.25rem' }}
            >
              <span>{q}</span>
              <span style={{ color: C.accent, fontSize: '1.375rem', lineHeight: 1, flexShrink: 0, transform: open === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s ease', display: 'inline-block' }}>
                +
              </span>
            </button>
            {open === i && (
              <div style={{ paddingBottom: '1.125rem', color: C.text2, fontSize: '0.9rem', lineHeight: 1.7, animation: 'fadeIn 0.2s ease' }}>
                {a}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
