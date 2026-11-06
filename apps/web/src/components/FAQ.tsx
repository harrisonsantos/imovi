'use client';

import { useState } from 'react';
import { tokens as C } from '@/lib/tokens';

export const FAQ_ITEMS: [string, string][] = [
  [
    'O imovi substitui um avaliador profissional?',
    'Não. O imovi oferece uma referência heurística de valor para orientar conversas de compra, venda e precificação. Laudos de avaliação seguem a NBR 14653 e são emitidos por profissional habilitado, como corretor avaliador inscrito no CNAI ou engenheiro e arquiteto registrados.',
  ],
  [
    'De onde vêm os dados?',
    'A origem aparece em cada resultado: referência inicial aproximada, mediana de anúncios ou dados insuficientes. A data de atualização e a quantidade de imóveis distintos são informadas quando disponíveis.',
  ],
  [
    'Qual é a precisão do modelo?',
    'A versão atual usa uma heurística sem precisão estatística validada. A margem fixa de ±30% é apenas indicativa. O modelo de aprendizado de máquina permanece desativado até validação.',
  ],
  [
    'O serviço é realmente gratuito?',
    'A estimativa básica é gratuita, com limite de uso para proteção contra abuso. Funcionalidades profissionais de estimativa estão em estudo.',
  ],
  [
    'Quais cidades são cobertas?',
    'As cidades e bairros disponíveis aparecem no formulário. Uma cidade só é incluída quando há referência de preço para os bairros, e não divulgamos datas para novas cidades.',
  ],
  [
    'Meus dados ficam armazenados?',
    'Os parâmetros do imóvel e o resultado são armazenados para recuperar a estimativa por uma referência pública. Não envie dados pessoais. O e-mail da lista de espera é salvo somente com seu consentimento.',
  ],
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section style={{ padding: 'clamp(4rem,8vh,5.5rem) clamp(1rem,4vw,2.5rem)' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <p
          style={{
            fontSize: '0.6875rem',
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            color: C.accent,
            marginBottom: '0.75rem',
          }}
        >
          Dúvidas frequentes
        </p>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 'clamp(1.75rem,3vw,2.375rem)',
            letterSpacing: '-0.03em',
            marginBottom: '2rem',
          }}
        >
          FAQ
        </h2>
        {FAQ_ITEMS.map(([q, a], i) => (
          <div key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.125rem 0',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: C.text,
                fontSize: '0.9375rem',
                fontWeight: 500,
                fontFamily: 'var(--font-body)',
                textAlign: 'left',
                gap: '1.25rem',
              }}
            >
              <span>{q}</span>
              <span
                style={{
                  color: C.accent,
                  fontSize: '1.375rem',
                  lineHeight: 1,
                  flexShrink: 0,
                  transform: open === i ? 'rotate(45deg)' : 'none',
                  transition: 'transform 0.2s ease',
                  display: 'inline-block',
                }}
              >
                +
              </span>
            </button>
            {open === i && (
              <div
                style={{
                  paddingBottom: '1.125rem',
                  color: C.text2,
                  fontSize: '0.9rem',
                  lineHeight: 1.7,
                  animation: 'fadeIn 0.2s ease',
                }}
              >
                {a}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
