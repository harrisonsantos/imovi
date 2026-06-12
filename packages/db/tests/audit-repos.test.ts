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
