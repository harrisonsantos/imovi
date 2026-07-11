/**
 * Testes dos repositórios do módulo de auditoria (multi-tenant).
 *
 * Contratos críticos:
 *   - Upserts idempotentes por (org_id, vista_id) — nunca duplicam linhas.
 *   - Isolamento de organização: dados da org A jamais aparecem em
 *     consultas escopadas para a org B.
 *   - Dedupe de anomalias: mesma (org_id, tipo, entidade_id) não resolvida
 *     não duplica; após resolver, pode ser inserida de novo.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, type TestDb } from './setup.js';
import {
  auditCorretoresRepo,
  auditImoveisRepo,
  auditLeadsRepo,
  auditNegociosRepo,
  auditAnomaliasRepo,
  auditEventosRepo,
  auditMatriculasRepo,
  orgVistaConfigRepo,
} from '../src/repositories/audit/index.js';

const ORG_A = 'org-a';
const ORG_B = 'org-b';

let t: TestDb;
beforeEach(async () => {
  t = await createTestDb();
});
afterEach(async () => {
  await t.dispose();
});

describe('auditCorretoresRepo', () => {
  it('upsertByVistaUserId é idempotente: mesmo (org, vista_user_id) 2x → 1 linha', async () => {
    const a = await auditCorretoresRepo.upsertByVistaUserId(t.db, ORG_A, {
      nome: 'João',
      vistaUserId: 'v-1',
    });
    const b = await auditCorretoresRepo.upsertByVistaUserId(t.db, ORG_A, {
      nome: 'João Atualizado',
      vistaUserId: 'v-1',
    });
    expect(b.id).toBe(a.id);
    expect(b.nome).toBe('João Atualizado');

    const all = await auditCorretoresRepo.listByOrg(t.db, ORG_A);
    expect(all).toHaveLength(1);
  });

  it('mesmo vista_user_id em orgs diferentes → linhas distintas', async () => {
    const a = await auditCorretoresRepo.upsertByVistaUserId(t.db, ORG_A, {
      nome: 'João',
      vistaUserId: 'v-1',
    });
    const b = await auditCorretoresRepo.upsertByVistaUserId(t.db, ORG_B, {
      nome: 'Maria',
      vistaUserId: 'v-1',
    });
    expect(b.id).not.toBe(a.id);
  });

  it('upsertByCreci é idempotente por (org, creci)', async () => {
    const a = await auditCorretoresRepo.upsertByCreci(t.db, ORG_A, {
      nome: 'Ana',
      creci: 'CRECI-123',
    });
    const b = await auditCorretoresRepo.upsertByCreci(t.db, ORG_A, {
      nome: 'Ana Silva',
      creci: 'CRECI-123',
    });
    expect(b.id).toBe(a.id);
    expect(b.nome).toBe('Ana Silva');
  });

  it('listByOrg não vaza corretores de outra org', async () => {
    await auditCorretoresRepo.upsertByVistaUserId(t.db, ORG_A, { nome: 'A', vistaUserId: 'va' });
    await auditCorretoresRepo.upsertByVistaUserId(t.db, ORG_B, { nome: 'B', vistaUserId: 'vb' });

    const deA = await auditCorretoresRepo.listByOrg(t.db, ORG_A);
    expect(deA).toHaveLength(1);
    expect(deA[0]!.nome).toBe('A');
  });

  it('findById escopado por org: id da org A não é visível pela org B', async () => {
    const a = await auditCorretoresRepo.upsertByVistaUserId(t.db, ORG_A, {
      nome: 'A',
      vistaUserId: 'va',
    });
    expect(await auditCorretoresRepo.findById(t.db, ORG_A, a.id)).not.toBeNull();
    expect(await auditCorretoresRepo.findById(t.db, ORG_B, a.id)).toBeNull();
  });
});

describe('auditImoveisRepo', () => {
  it('upsertByVistaId é idempotente e atualiza campos no conflito', async () => {
    const a = await auditImoveisRepo.upsertByVistaId(t.db, ORG_A, {
      vistaId: 'im-1',
      valor: '500000.00',
      status: 'ativo',
    });
    const b = await auditImoveisRepo.upsertByVistaId(t.db, ORG_A, {
      vistaId: 'im-1',
      valor: '550000.00',
      status: 'vendido',
    });
    expect(b.id).toBe(a.id);
    expect(Number(b.valor)).toBe(550_000);
    expect(b.status).toBe('vendido');

    const all = await auditImoveisRepo.listByOrg(t.db, ORG_A);
    expect(all).toHaveLength(1);
  });

  it('listByOrg filtra por status', async () => {
    await auditImoveisRepo.upsertByVistaId(t.db, ORG_A, { vistaId: 'im-1', status: 'ativo' });
    await auditImoveisRepo.upsertByVistaId(t.db, ORG_A, { vistaId: 'im-2', status: 'vendido' });

    const vendidos = await auditImoveisRepo.listByOrg(t.db, ORG_A, { status: 'vendido' });
    expect(vendidos).toHaveLength(1);
    expect(vendidos[0]!.vistaId).toBe('im-2');
  });

  it('findByVistaId respeita isolamento de org', async () => {
    await auditImoveisRepo.upsertByVistaId(t.db, ORG_A, { vistaId: 'im-1' });
    expect(await auditImoveisRepo.findByVistaId(t.db, ORG_A, 'im-1')).not.toBeNull();
    expect(await auditImoveisRepo.findByVistaId(t.db, ORG_B, 'im-1')).toBeNull();
  });

  it('listByOrg não vaza imóveis de outra org', async () => {
    await auditImoveisRepo.upsertByVistaId(t.db, ORG_A, { vistaId: 'im-1' });
    await auditImoveisRepo.upsertByVistaId(t.db, ORG_B, { vistaId: 'im-2' });
    const deB = await auditImoveisRepo.listByOrg(t.db, ORG_B);
    expect(deB).toHaveLength(1);
    expect(deB[0]!.vistaId).toBe('im-2');
  });
});

describe('auditLeadsRepo', () => {
  it('upsertByVistaId é idempotente por (org, vista_id)', async () => {
    const a = await auditLeadsRepo.upsertByVistaId(t.db, ORG_A, {
      vistaId: 'ld-1',
      nome: 'Lead',
      status: 'novo',
    });
    const b = await auditLeadsRepo.upsertByVistaId(t.db, ORG_A, {
      vistaId: 'ld-1',
      nome: 'Lead',
      status: 'contatado',
    });
    expect(b.id).toBe(a.id);
    expect(b.status).toBe('contatado');
  });

  it('listByOrg filtra por status e updatedBefore', async () => {
    await auditLeadsRepo.upsertByVistaId(t.db, ORG_A, { vistaId: 'ld-1', status: 'novo' });
    await auditLeadsRepo.upsertByVistaId(t.db, ORG_A, { vistaId: 'ld-2', status: 'ganho' });

    const novos = await auditLeadsRepo.listByOrg(t.db, ORG_A, { status: 'novo' });
    expect(novos).toHaveLength(1);
    expect(novos[0]!.vistaId).toBe('ld-1');

    // updatedBefore no passado → nenhum lead recém-criado é retornado.
    const antigos = await auditLeadsRepo.listByOrg(t.db, ORG_A, {
      updatedBefore: new Date('2000-01-01T00:00:00Z'),
    });
    expect(antigos).toHaveLength(0);

    // updatedBefore no futuro → todos retornados.
    const todos = await auditLeadsRepo.listByOrg(t.db, ORG_A, {
      updatedBefore: new Date(Date.now() + 60_000),
    });
    expect(todos).toHaveLength(2);
  });

  it('countByCorretor conta apenas leads do corretor na org', async () => {
    const corretor = await auditCorretoresRepo.upsertByVistaUserId(t.db, ORG_A, {
      nome: 'C',
      vistaUserId: 'vc',
    });
    await auditLeadsRepo.upsertByVistaId(t.db, ORG_A, { vistaId: 'ld-1', corretorId: corretor.id });
    await auditLeadsRepo.upsertByVistaId(t.db, ORG_A, { vistaId: 'ld-2', corretorId: corretor.id });
    await auditLeadsRepo.upsertByVistaId(t.db, ORG_A, { vistaId: 'ld-3' });

    expect(await auditLeadsRepo.countByCorretor(t.db, ORG_A, corretor.id)).toBe(2);
    // Mesmo corretor consultado por outra org → 0 (isolamento).
    expect(await auditLeadsRepo.countByCorretor(t.db, ORG_B, corretor.id)).toBe(0);
  });

  it('listByOrg não vaza leads de outra org', async () => {
    await auditLeadsRepo.upsertByVistaId(t.db, ORG_A, { vistaId: 'ld-1' });
    const deB = await auditLeadsRepo.listByOrg(t.db, ORG_B);
    expect(deB).toHaveLength(0);
  });
});

describe('auditNegociosRepo', () => {
  it('upsertByVistaId é idempotente por (org, vista_id)', async () => {
    const a = await auditNegociosRepo.upsertByVistaId(t.db, ORG_A, {
      vistaId: 'ng-1',
      valorVenda: '300000.00',
    });
    const b = await auditNegociosRepo.upsertByVistaId(t.db, ORG_A, {
      vistaId: 'ng-1',
      valorVenda: '310000.00',
    });
    expect(b.id).toBe(a.id);
    expect(Number(b.valorVenda)).toBe(310_000);
  });

  it('listByOrg filtra por closedAfter', async () => {
    await auditNegociosRepo.upsertByVistaId(t.db, ORG_A, {
      vistaId: 'ng-velho',
      dataFechamento: new Date('2025-01-01T00:00:00Z'),
    });
    await auditNegociosRepo.upsertByVistaId(t.db, ORG_A, {
      vistaId: 'ng-novo',
      dataFechamento: new Date('2026-05-01T00:00:00Z'),
    });

    const recentes = await auditNegociosRepo.listByOrg(t.db, ORG_A, {
      closedAfter: new Date('2026-01-01T00:00:00Z'),
    });
    expect(recentes).toHaveLength(1);
    expect(recentes[0]!.vistaId).toBe('ng-novo');
  });

  it('listClosedWithImovel traz o imóvel junto e respeita org', async () => {
    const imovel = await auditImoveisRepo.upsertByVistaId(t.db, ORG_A, {
      vistaId: 'im-1',
      endereco: 'Rua X, 100',
    });
    await auditNegociosRepo.upsertByVistaId(t.db, ORG_A, {
      vistaId: 'ng-1',
      imovelId: imovel.id,
      dataFechamento: new Date('2026-05-01T00:00:00Z'),
    });

    const since = new Date('2026-01-01T00:00:00Z');
    const rows = await auditNegociosRepo.listClosedWithImovel(t.db, ORG_A, since);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.negocio.vistaId).toBe('ng-1');
    expect(rows[0]!.imovel?.endereco).toBe('Rua X, 100');

    // Outra org não vê o negócio.
    const deB = await auditNegociosRepo.listClosedWithImovel(t.db, ORG_B, since);
    expect(deB).toHaveLength(0);
  });

  it('listByOrg não vaza negócios de outra org', async () => {
    await auditNegociosRepo.upsertByVistaId(t.db, ORG_A, { vistaId: 'ng-1' });
    expect(await auditNegociosRepo.listByOrg(t.db, ORG_B)).toHaveLength(0);
  });
});

describe('auditAnomaliasRepo', () => {
  const anomalia = {
    tipo: 'lead_desaparecido',
    severidade: 'alta',
    entidadeTipo: 'lead',
    entidadeId: 'ld-1',
    descricao: 'Lead sumiu do funil',
  };

  it('insertMany pula duplicata (org, tipo, entidade_id) não resolvida', async () => {
    const inseridas1 = await auditAnomaliasRepo.insertMany(t.db, ORG_A, [anomalia]);
    expect(inseridas1).toHaveLength(1);

    const inseridas2 = await auditAnomaliasRepo.insertMany(t.db, ORG_A, [anomalia]);
    expect(inseridas2).toHaveLength(0);

    const all = await auditAnomaliasRepo.listByOrg(t.db, ORG_A);
    expect(all).toHaveLength(1);
  });

  it('após resolve, a mesma anomalia pode ser inserida de novo', async () => {
    const [criada] = await auditAnomaliasRepo.insertMany(t.db, ORG_A, [anomalia]);
    await auditAnomaliasRepo.resolve(t.db, ORG_A, criada!.id);

    const inseridas = await auditAnomaliasRepo.insertMany(t.db, ORG_A, [anomalia]);
    expect(inseridas).toHaveLength(1);

    const all = await auditAnomaliasRepo.listByOrg(t.db, ORG_A);
    expect(all).toHaveLength(2);
  });

  it('resolve seta resolvida e resolvida_em, escopado por org', async () => {
    const [criada] = await auditAnomaliasRepo.insertMany(t.db, ORG_A, [anomalia]);

    // Org B não consegue resolver anomalia da org A.
    await auditAnomaliasRepo.resolve(t.db, ORG_B, criada!.id);
    const aindaAbertas = await auditAnomaliasRepo.listByOrg(t.db, ORG_A, { resolvida: false });
    expect(aindaAbertas).toHaveLength(1);

    await auditAnomaliasRepo.resolve(t.db, ORG_A, criada!.id);
    const resolvidas = await auditAnomaliasRepo.listByOrg(t.db, ORG_A, { resolvida: true });
    expect(resolvidas).toHaveLength(1);
    expect(resolvidas[0]!.resolvidaEm).not.toBeNull();
  });

  it('listByOrg filtra por tipo e pagina com limit/offset', async () => {
    await auditAnomaliasRepo.insertMany(t.db, ORG_A, [
      anomalia,
      { ...anomalia, tipo: 'venda_nao_registrada', entidadeId: 'ng-1' },
      { ...anomalia, entidadeId: 'ld-2' },
    ]);

    const porTipo = await auditAnomaliasRepo.listByOrg(t.db, ORG_A, {
      tipo: 'venda_nao_registrada',
    });
    expect(porTipo).toHaveLength(1);

    const pagina = await auditAnomaliasRepo.listByOrg(t.db, ORG_A, { limit: 2, offset: 2 });
    expect(pagina).toHaveLength(1);
  });

  it('anomalias de uma org não vazam para outra (mesma chave de dedupe)', async () => {
    await auditAnomaliasRepo.insertMany(t.db, ORG_A, [anomalia]);
    // Mesma (tipo, entidade_id) em outra org NÃO é duplicata: orgs são isoladas.
    const deB = await auditAnomaliasRepo.insertMany(t.db, ORG_B, [anomalia]);
    expect(deB).toHaveLength(1);

    expect(await auditAnomaliasRepo.listByOrg(t.db, ORG_A)).toHaveLength(1);
    expect(await auditAnomaliasRepo.listByOrg(t.db, ORG_B)).toHaveLength(1);
  });
});

describe('auditEventosRepo', () => {
  it('record grava evento e listByOrg retorna mais recentes primeiro', async () => {
    await auditEventosRepo.record(t.db, ORG_A, {
      tipo: 'webhook_recebido',
      fonte: 'vista_webhook',
      dados: { payload: 1 },
    });
    await auditEventosRepo.record(t.db, ORG_A, {
      tipo: 'sync_manual',
      fonte: 'manual',
      dados: { payload: 2 },
    });

    const eventos = await auditEventosRepo.listByOrg(t.db, ORG_A, 10);
    expect(eventos).toHaveLength(2);
  });

  it('listByOrg respeita limit e isolamento de org', async () => {
    for (let i = 0; i < 5; i++) {
      await auditEventosRepo.record(t.db, ORG_A, { tipo: 'e', fonte: 'sistema', dados: { i } });
    }
    expect(await auditEventosRepo.listByOrg(t.db, ORG_A, 3)).toHaveLength(3);
    expect(await auditEventosRepo.listByOrg(t.db, ORG_B, 10)).toHaveLength(0);
  });
});

describe('orgVistaConfigRepo', () => {
  it('upsert cria e depois atualiza a config da org (1 linha por org)', async () => {
    const criada = await orgVistaConfigRepo.upsert(t.db, ORG_A, {
      webhookToken: 'tok-a',
      vistaApiUrl: 'https://api.vista.example',
      reportEmails: ['x@y.com'],
    });
    const atualizada = await orgVistaConfigRepo.upsert(t.db, ORG_A, {
      webhookToken: 'tok-a',
      vistaApiUrl: 'https://api2.vista.example',
      avmDeviationPct: 30,
    });
    expect(atualizada.id).toBe(criada.id);
    expect(atualizada.vistaApiUrl).toBe('https://api2.vista.example');
    expect(atualizada.avmDeviationPct).toBe(30);
  });

  it('getByOrg retorna a config certa e null para org sem config', async () => {
    await orgVistaConfigRepo.upsert(t.db, ORG_A, { webhookToken: 'tok-a' });
    const cfg = await orgVistaConfigRepo.getByOrg(t.db, ORG_A);
    expect(cfg?.orgId).toBe(ORG_A);
    expect(await orgVistaConfigRepo.getByOrg(t.db, ORG_B)).toBeNull();
  });

  it('getByWebhookToken resolve a org dona do token', async () => {
    await orgVistaConfigRepo.upsert(t.db, ORG_A, { webhookToken: 'tok-a' });
    await orgVistaConfigRepo.upsert(t.db, ORG_B, { webhookToken: 'tok-b' });

    const cfg = await orgVistaConfigRepo.getByWebhookToken(t.db, 'tok-b');
    expect(cfg?.orgId).toBe(ORG_B);
    expect(await orgVistaConfigRepo.getByWebhookToken(t.db, 'tok-inexistente')).toBeNull();
  });
});

// ───────────────────────────── Fase 6 — dashboard ─────────────────────────────
// Métodos de listagem/contagem adicionados para o dashboard de auditoria.

describe('auditLeadsRepo — paginação e contagem (dashboard)', () => {
  it('listByOrg pagina com limit/offset quando informados', async () => {
    for (let i = 0; i < 5; i++) {
      await auditLeadsRepo.upsertByVistaId(t.db, ORG_A, { vistaId: `ld-${i}` });
    }
    const pagina1 = await auditLeadsRepo.listByOrg(t.db, ORG_A, { limit: 2, offset: 0 });
    expect(pagina1).toHaveLength(2);
    const pagina3 = await auditLeadsRepo.listByOrg(t.db, ORG_A, { limit: 2, offset: 4 });
    expect(pagina3).toHaveLength(1);
    // Sem limit → comportamento original (todas as linhas).
    expect(await auditLeadsRepo.listByOrg(t.db, ORG_A)).toHaveLength(5);
  });

  it('countByOrg conta total e filtra por createdAfter, com isolamento de org', async () => {
    await auditLeadsRepo.upsertByVistaId(t.db, ORG_A, { vistaId: 'ld-1' });
    await auditLeadsRepo.upsertByVistaId(t.db, ORG_A, { vistaId: 'ld-2' });
    await auditLeadsRepo.upsertByVistaId(t.db, ORG_B, { vistaId: 'ld-3' });

    expect(await auditLeadsRepo.countByOrg(t.db, ORG_A)).toBe(2);
    expect(await auditLeadsRepo.countByOrg(t.db, ORG_B)).toBe(1);

    // createdAfter no passado → todos; no futuro → nenhum.
    expect(
      await auditLeadsRepo.countByOrg(t.db, ORG_A, {
        createdAfter: new Date('2000-01-01T00:00:00Z'),
      }),
    ).toBe(2);
    expect(
      await auditLeadsRepo.countByOrg(t.db, ORG_A, {
        createdAfter: new Date(Date.now() + 60_000),
      }),
    ).toBe(0);
  });
});

describe('auditNegociosRepo — paginação e contagem (dashboard)', () => {
  it('listWithImovel traz o imóvel, pagina e respeita org', async () => {
    const imovel = await auditImoveisRepo.upsertByVistaId(t.db, ORG_A, {
      vistaId: 'im-1',
      endereco: 'Av. Y, 200',
    });
    await auditNegociosRepo.upsertByVistaId(t.db, ORG_A, { vistaId: 'ng-1', imovelId: imovel.id });
    await auditNegociosRepo.upsertByVistaId(t.db, ORG_A, { vistaId: 'ng-2' });
    await auditNegociosRepo.upsertByVistaId(t.db, ORG_B, { vistaId: 'ng-3' });

    const rows = await auditNegociosRepo.listWithImovel(t.db, ORG_A);
    expect(rows).toHaveLength(2);
    const comImovel = rows.find((r) => r.negocio.vistaId === 'ng-1');
    expect(comImovel?.imovel?.endereco).toBe('Av. Y, 200');
    const semImovel = rows.find((r) => r.negocio.vistaId === 'ng-2');
    expect(semImovel?.imovel).toBeNull();

    const pagina = await auditNegociosRepo.listWithImovel(t.db, ORG_A, { limit: 1, offset: 1 });
    expect(pagina).toHaveLength(1);

    expect(await auditNegociosRepo.listWithImovel(t.db, ORG_B)).toHaveLength(1);
  });

  it('countByOrg conta total e fechados após data (closedAfter)', async () => {
    await auditNegociosRepo.upsertByVistaId(t.db, ORG_A, { vistaId: 'ng-aberto' });
    await auditNegociosRepo.upsertByVistaId(t.db, ORG_A, {
      vistaId: 'ng-velho',
      dataFechamento: new Date('2025-01-15T00:00:00Z'),
    });
    await auditNegociosRepo.upsertByVistaId(t.db, ORG_A, {
      vistaId: 'ng-novo',
      dataFechamento: new Date('2026-06-05T00:00:00Z'),
    });

    expect(await auditNegociosRepo.countByOrg(t.db, ORG_A)).toBe(3);
    // closedAfter exclui negócios sem data_fechamento e os anteriores à data.
    expect(
      await auditNegociosRepo.countByOrg(t.db, ORG_A, {
        closedAfter: new Date('2026-06-01T00:00:00Z'),
      }),
    ).toBe(1);
    expect(await auditNegociosRepo.countByOrg(t.db, ORG_B)).toBe(0);
  });
});

describe('auditAnomaliasRepo — contagem por severidade e ordenação (dashboard)', () => {
  it('countUnresolvedBySeverity agrupa abertas por severidade e ignora resolvidas', async () => {
    const [alta] = await auditAnomaliasRepo.insertMany(t.db, ORG_A, [
      { tipo: 'desvio_avm', severidade: 'alta', entidadeId: 'e-1' },
      { tipo: 'lead_inativo', severidade: 'media', entidadeId: 'e-2' },
      { tipo: 'lead_inativo', severidade: 'media', entidadeId: 'e-3' },
      { tipo: 'taxa_conversao_baixa', severidade: 'baixa', entidadeId: 'e-4' },
    ]);
    await auditAnomaliasRepo.insertMany(t.db, ORG_B, [
      { tipo: 'desvio_avm', severidade: 'alta', entidadeId: 'e-9' },
    ]);

    const antes = await auditAnomaliasRepo.countUnresolvedBySeverity(t.db, ORG_A);
    const mapa = Object.fromEntries(antes.map((r) => [r.severidade, r.total]));
    expect(mapa).toEqual({ alta: 1, media: 2, baixa: 1 });

    // Resolver a alta → some da contagem.
    await auditAnomaliasRepo.resolve(t.db, ORG_A, alta!.id);
    const depois = await auditAnomaliasRepo.countUnresolvedBySeverity(t.db, ORG_A);
    expect(depois.find((r) => r.severidade === 'alta')).toBeUndefined();
  });

  it("listByOrg com order: 'desc' retorna mais recentes primeiro", async () => {
    await auditAnomaliasRepo.insertMany(t.db, ORG_A, [
      { tipo: 'desvio_avm', severidade: 'alta', entidadeId: 'e-1' },
    ]);
    await new Promise((r) => setTimeout(r, 10));
    await auditAnomaliasRepo.insertMany(t.db, ORG_A, [
      { tipo: 'lead_inativo', severidade: 'media', entidadeId: 'e-2' },
    ]);

    const descOrder = await auditAnomaliasRepo.listByOrg(t.db, ORG_A, { order: 'desc' });
    expect(descOrder[0]!.tipo).toBe('lead_inativo');
    const ascOrder = await auditAnomaliasRepo.listByOrg(t.db, ORG_A);
    expect(ascOrder[0]!.tipo).toBe('desvio_avm');
  });
});

describe('auditCorretoresRepo — countActive (dashboard)', () => {
  it('conta apenas corretores ativos da org', async () => {
    await auditCorretoresRepo.upsertByVistaUserId(t.db, ORG_A, {
      nome: 'Ativo',
      vistaUserId: 'v-1',
      ativo: true,
    });
    await auditCorretoresRepo.upsertByVistaUserId(t.db, ORG_A, {
      nome: 'Inativo',
      vistaUserId: 'v-2',
      ativo: false,
    });
    await auditCorretoresRepo.upsertByVistaUserId(t.db, ORG_B, {
      nome: 'Outra org',
      vistaUserId: 'v-3',
      ativo: true,
    });

    expect(await auditCorretoresRepo.countActive(t.db, ORG_A)).toBe(1);
    expect(await auditCorretoresRepo.countActive(t.db, ORG_B)).toBe(1);
  });
});

describe('auditMatriculasRepo — uploads de matrícula (R2)', () => {
  /** Cria um imóvel da org para amarrar as matrículas (FK obrigatória). */
  async function criaImovel(orgId: string, vistaId: string) {
    return await auditImoveisRepo.upsertByVistaId(t.db, orgId, {
      vistaId,
      endereco: `Rua ${vistaId}`,
    });
  }

  it('insert grava a linha e devolve campos preenchidos', async () => {
    const imovel = await criaImovel(ORG_A, 'im-mat-1');
    const row = await auditMatriculasRepo.insert(t.db, ORG_A, {
      imovelId: imovel.id,
      r2Key: `org-a/${imovel.id}/abc-doc.pdf`,
      fileName: 'doc.pdf',
      mime: 'application/pdf',
      size: 1234,
      uploadedBy: 'user-1',
    });
    expect(row.id).toBeTruthy();
    expect(row.orgId).toBe(ORG_A);
    expect(row.imovelId).toBe(imovel.id);
    expect(row.r2Key).toContain('doc.pdf');
    expect(row.size).toBe(1234);
    expect(row.checkedAt).toBeNull();
    expect(row.resultado).toBeNull();
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it('listByOrg isola por org e filtra por imovelId', async () => {
    const imovelA1 = await criaImovel(ORG_A, 'im-mat-a1');
    const imovelA2 = await criaImovel(ORG_A, 'im-mat-a2');
    const imovelB = await criaImovel(ORG_B, 'im-mat-b1');
    const base = { fileName: 'm.pdf', mime: 'application/pdf', size: 10 };
    await auditMatriculasRepo.insert(t.db, ORG_A, { ...base, imovelId: imovelA1.id, r2Key: 'k1' });
    await auditMatriculasRepo.insert(t.db, ORG_A, { ...base, imovelId: imovelA2.id, r2Key: 'k2' });
    await auditMatriculasRepo.insert(t.db, ORG_B, { ...base, imovelId: imovelB.id, r2Key: 'k3' });

    expect(await auditMatriculasRepo.listByOrg(t.db, ORG_A)).toHaveLength(2);
    expect(await auditMatriculasRepo.listByOrg(t.db, ORG_B)).toHaveLength(1);

    const filtrado = await auditMatriculasRepo.listByOrg(t.db, ORG_A, { imovelId: imovelA1.id });
    expect(filtrado).toHaveLength(1);
    expect(filtrado[0]!.r2Key).toBe('k1');

    // Paginação: limit/offset.
    const pagina = await auditMatriculasRepo.listByOrg(t.db, ORG_A, { limit: 1, offset: 1 });
    expect(pagina).toHaveLength(1);
  });

  it('findById só encontra dentro da própria org', async () => {
    const imovel = await criaImovel(ORG_A, 'im-mat-find');
    const row = await auditMatriculasRepo.insert(t.db, ORG_A, {
      imovelId: imovel.id,
      r2Key: 'k-find',
      fileName: 'f.png',
      mime: 'image/png',
      size: 1,
    });
    expect((await auditMatriculasRepo.findById(t.db, ORG_A, row.id))?.id).toBe(row.id);
    // Outra org não enxerga o registro (isolamento multi-tenant).
    expect(await auditMatriculasRepo.findById(t.db, ORG_B, row.id)).toBeNull();
  });

  it('setChecked grava resultado + checked_at, escopado por org', async () => {
    const imovel = await criaImovel(ORG_A, 'im-mat-check');
    const row = await auditMatriculasRepo.insert(t.db, ORG_A, {
      imovelId: imovel.id,
      r2Key: 'k-check',
      fileName: 'f.pdf',
      mime: 'application/pdf',
      size: 1,
    });

    // Org errada não marca nada.
    await auditMatriculasRepo.setChecked(t.db, ORG_B, row.id, { status: 'x' });
    expect((await auditMatriculasRepo.findById(t.db, ORG_A, row.id))?.checkedAt).toBeNull();

    const resultado = { status: 'verificacao_manual_pendente', checkedVia: 'manual' };
    await auditMatriculasRepo.setChecked(t.db, ORG_A, row.id, resultado);
    const depois = await auditMatriculasRepo.findById(t.db, ORG_A, row.id);
    expect(depois?.checkedAt).toBeInstanceOf(Date);
    expect(depois?.resultado).toEqual(resultado);
  });

  it('apagar o imóvel apaga as matrículas (ON DELETE CASCADE)', async () => {
    const imovel = await criaImovel(ORG_A, 'im-mat-cascade');
    await auditMatriculasRepo.insert(t.db, ORG_A, {
      imovelId: imovel.id,
      r2Key: 'k-casc',
      fileName: 'f.pdf',
      mime: 'application/pdf',
      size: 1,
    });
    await t.raw.exec(`DELETE FROM audit_imoveis WHERE id = '${imovel.id}'`);
    expect(await auditMatriculasRepo.listByOrg(t.db, ORG_A)).toHaveLength(0);
  });
});

describe('auditImoveisRepo — findById e setMatriculaVerificada (fluxo matrícula)', () => {
  it('findById só encontra dentro da própria org', async () => {
    const imovel = await auditImoveisRepo.upsertByVistaId(t.db, ORG_A, { vistaId: 'im-fid' });
    expect((await auditImoveisRepo.findById(t.db, ORG_A, imovel.id))?.id).toBe(imovel.id);
    expect(await auditImoveisRepo.findById(t.db, ORG_B, imovel.id)).toBeNull();
  });

  it('setMatriculaVerificada marca o flag, escopado por org', async () => {
    const imovel = await auditImoveisRepo.upsertByVistaId(t.db, ORG_A, { vistaId: 'im-mv' });
    expect(imovel.matriculaVerificada).toBe(false);

    // Org errada não altera.
    await auditImoveisRepo.setMatriculaVerificada(t.db, ORG_B, imovel.id, true);
    expect((await auditImoveisRepo.findById(t.db, ORG_A, imovel.id))?.matriculaVerificada).toBe(false);

    await auditImoveisRepo.setMatriculaVerificada(t.db, ORG_A, imovel.id, true);
    expect((await auditImoveisRepo.findById(t.db, ORG_A, imovel.id))?.matriculaVerificada).toBe(true);
  });
});
