/**
 * Testes do relatório diário (fase 5) — funções puras:
 *   - `buildDailyReport`: agrega métricas a partir de arrays de linhas;
 *   - `dailyReportHtml`: HTML self-contained (inline styles, layout claro).
 */
import { describe, expect, it } from 'vitest';
import {
  buildDailyReport,
  dailyReportHtml,
  type DailyReportInput,
} from '../src/email/daily-report.js';

/** "Agora" de referência: 2026-06-10 15:00 UTC. */
const AGORA = new Date('2026-06-10T15:00:00Z');
const HOJE = (h: number) => new Date(`2026-06-10T0${h}:00:00Z`);
const ONTEM = new Date('2026-06-09T12:00:00Z');

function makeInput(overrides: Partial<DailyReportInput> = {}): DailyReportInput {
  return {
    now: AGORA,
    leads: [],
    negocios: [],
    corretores: [],
    anomalias: [],
    ...overrides,
  };
}

describe('buildDailyReport', () => {
  it('conta apenas leads criados no dia de referência (UTC)', () => {
    const report = buildDailyReport(
      makeInput({
        leads: [
          { id: 'l1', corretorId: null, createdAt: HOJE(1) },
          { id: 'l2', corretorId: null, createdAt: HOJE(9) },
          { id: 'l3', corretorId: null, createdAt: ONTEM },
        ],
      }),
    );

    expect(report.dataReferencia).toBe('2026-06-10');
    expect(report.leadsDoDia).toBe(2);
  });

  it('conta apenas negócios com data_fechamento no dia de referência', () => {
    const report = buildDailyReport(
      makeInput({
        negocios: [
          { id: 'n1', corretorId: null, status: 'concluído', dataFechamento: HOJE(8) },
          { id: 'n2', corretorId: null, status: 'concluído', dataFechamento: ONTEM },
          { id: 'n3', corretorId: null, status: 'proposta', dataFechamento: null },
        ],
      }),
    );

    expect(report.negociosFechadosDoDia).toBe(1);
  });

  it('taxa de conversão geral = negócios concluídos / total de leads (em %, 1 casa)', () => {
    const report = buildDailyReport(
      makeInput({
        leads: [
          { id: 'l1', corretorId: null, createdAt: ONTEM },
          { id: 'l2', corretorId: null, createdAt: ONTEM },
          { id: 'l3', corretorId: null, createdAt: ONTEM },
        ],
        negocios: [
          { id: 'n1', corretorId: null, status: 'concluído', dataFechamento: ONTEM },
          // status diferente de 'concluído' não conta na conversão
          { id: 'n2', corretorId: null, status: 'proposta', dataFechamento: null },
        ],
      }),
    );

    // 1 concluído / 3 leads = 33.3%
    expect(report.taxaConversaoGeral).toBeCloseTo(33.3, 1);
  });

  it('taxa de conversão é 0 quando não há leads (sem divisão por zero)', () => {
    const report = buildDailyReport(
      makeInput({
        negocios: [{ id: 'n1', corretorId: null, status: 'concluído', dataFechamento: ONTEM }],
      }),
    );

    expect(report.taxaConversaoGeral).toBe(0);
  });

  it('agrupa anomalias novas (criadas no dia) por severidade; antigas ficam de fora', () => {
    const report = buildDailyReport(
      makeInput({
        anomalias: [
          { severidade: 'alta', createdAt: HOJE(7) },
          { severidade: 'alta', createdAt: HOJE(8) },
          { severidade: 'media', createdAt: HOJE(9) },
          { severidade: 'baixa', createdAt: ONTEM }, // antiga — não entra
        ],
      }),
    );

    expect(report.anomaliasPorSeveridade).toEqual({ alta: 2, media: 1, baixa: 0 });
  });

  it('top corretores ordena por negócios concluídos, resolve nome e limita a 5', () => {
    const corretores = Array.from({ length: 7 }, (_, i) => ({
      id: `c${i}`,
      nome: `Corretor ${i}`,
    }));
    // c0 fecha 3, c1 fecha 1, c2..c6 fecham 2 cada (7 corretores com negócio)
    const negocios = [
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `n-c0-${i}`,
        corretorId: 'c0',
        status: 'concluído',
        dataFechamento: ONTEM,
      })),
      { id: 'n-c1', corretorId: 'c1', status: 'concluído', dataFechamento: ONTEM },
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `n-c${i + 2}`,
        corretorId: `c${i + 2}`,
        status: 'concluído',
        dataFechamento: ONTEM,
      })),
      // não-concluído não conta
      { id: 'n-prop', corretorId: 'c1', status: 'proposta', dataFechamento: null },
    ];

    const report = buildDailyReport(makeInput({ corretores, negocios }));

    expect(report.topCorretores).toHaveLength(5);
    expect(report.topCorretores[0]).toEqual({ corretorId: 'c0', nome: 'Corretor 0', negocios: 3 });
    // c1 (1 negócio) fica fora do top 5: 3,1,1,1,1,1 → corte em 5
    expect(report.topCorretores.map((t) => t.negocios)).toEqual([3, 1, 1, 1, 1]);
  });

  it('corretor sem cadastro correspondente usa o id como nome (fallback)', () => {
    const report = buildDailyReport(
      makeInput({
        negocios: [
          { id: 'n1', corretorId: 'fantasma', status: 'concluído', dataFechamento: ONTEM },
        ],
      }),
    );

    expect(report.topCorretores).toEqual([
      { corretorId: 'fantasma', nome: 'fantasma', negocios: 1 },
    ]);
  });
});

describe('dailyReportHtml', () => {
  const report = buildDailyReport(
    makeInput({
      leads: [
        { id: 'l1', corretorId: 'c1', createdAt: HOJE(1) },
        { id: 'l2', corretorId: 'c1', createdAt: HOJE(2) },
      ],
      negocios: [{ id: 'n1', corretorId: 'c1', status: 'concluído', dataFechamento: HOJE(3) }],
      corretores: [{ id: 'c1', nome: 'Maria Corretora' }],
      anomalias: [{ severidade: 'alta', createdAt: HOJE(4) }],
    }),
  );

  const html = dailyReportHtml(report, 'Imobiliária Teste');

  it('inclui nome da org, data e os números-chave', () => {
    expect(html).toContain('Imobiliária Teste');
    expect(html).toContain('2026-06-10');
    expect(html).toContain('>2<'); // leads do dia
    expect(html).toContain('>1<'); // negócios fechados
    expect(html).toContain('50'); // taxa de conversão 50%
    expect(html).toContain('Maria Corretora');
  });

  it('lista as três severidades de anomalia', () => {
    expect(html.toLowerCase()).toContain('alta');
    expect(html.toLowerCase()).toContain('média');
    expect(html.toLowerCase()).toContain('baixa');
  });

  it('é e-mail-safe: tabelas com estilos inline, fundo claro e destaque emerald', () => {
    expect(html).toContain('<table');
    expect(html).toContain('style=');
    expect(html).toContain('#00d97e'); // emerald da paleta Imovi
    // Sem fundo dark-navy (#07090e é hostil a clientes de e-mail)
    expect(html).not.toContain('#07090e');
    // Sem dependências externas (CSS/JS) — self-contained
    expect(html).not.toContain('<link');
    expect(html).not.toContain('<script');
  });
});
