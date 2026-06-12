/**
 * Testes de ingest.ts — processamento de eventos do Vista CRM, multi-tenant.
 *
 * Usa pglite (Postgres in-process) com as mesmas migrations de produção.
 * Casos portados/adaptados do legado imobcheck/tests/webhook-api.test.ts.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  auditCorretoresRepo,
  auditImoveisRepo,
  auditLeadsRepo,
  auditNegociosRepo,
  auditEventosRepo,
} from '@imovi/db/audit';
import { processVistaEvent } from '../src/ingest.js';
import { createTestDb, type TestDb } from './setup.js';

const ORG = 'org_teste_1';
const ORG_B = 'org_teste_2';

let t: TestDb;

beforeEach(async () => {
  t = await createTestDb();
});

afterEach(async () => {
  await t.dispose();
});

describe('processVistaEvent — imovel.criado/atualizado', () => {
  it('cria imóvel com endereço completo montado a partir das partes', async () => {
    await processVistaEvent(t.db, ORG, {
      event_type: 'imovel.criado',
      data: {
        Codigo: '1001',
        Categoria: 'Apartamento',
        ValorVenda: 500000,
        Endereco: 'Rua Teste',
        Numero: '123',
        Complemento: 'Apto 45',
        Bairro: 'Centro',
        Cidade: 'São Paulo',
        Status: 'Ativo',
        Matricula: 'MAT-99',
      },
    });

    const imovel = await auditImoveisRepo.findByVistaId(t.db, ORG, '1001');
    expect(imovel).not.toBeNull();
    expect(imovel!.endereco).toBe('Rua Teste, 123, Apto 45, Centro, São Paulo');
    expect(imovel!.tipo).toBe('Apartamento');
    expect(Number(imovel!.valor)).toBe(500000);
    expect(imovel!.matricula).toBe('MAT-99');
    expect(imovel!.status).toBe('ativo');
  });

  it('usa ValorLocacao como fallback quando não há ValorVenda', async () => {
    await processVistaEvent(t.db, ORG, {
      event_type: 'imovel.criado',
      data: { Codigo: '1002', ValorLocacao: 2500 },
    });
    const imovel = await auditImoveisRepo.findByVistaId(t.db, ORG, '1002');
    expect(Number(imovel!.valor)).toBe(2500);
  });

  it('auto-cria corretor quando o payload traz Corretor com Creci', async () => {
    await processVistaEvent(t.db, ORG, {
      event_type: 'imovel.criado',
      data: {
        Codigo: '1003',
        CodigoCorretor: 'C-77',
        Corretor: { Nome: 'João Silva', 'E-mail': 'joao@imob.com', Creci: 'CRECI-555' },
      },
    });

    const corretores = await auditCorretoresRepo.listByOrg(t.db, ORG);
    expect(corretores).toHaveLength(1);
    expect(corretores[0]!.nome).toBe('João Silva');
    expect(corretores[0]!.creci).toBe('CRECI-555');
    expect(corretores[0]!.vistaUserId).toBe('C-77');

    const imovel = await auditImoveisRepo.findByVistaId(t.db, ORG, '1003');
    expect(imovel!.corretorId).toBe(corretores[0]!.id);
  });

  it('imovel.atualizado é idempotente — upsert pelo mesmo vista_id atualiza em vez de duplicar', async () => {
    await processVistaEvent(t.db, ORG, {
      event_type: 'imovel.criado',
      data: { Codigo: '1004', ValorVenda: 300000 },
    });
    await processVistaEvent(t.db, ORG, {
      event_type: 'imovel.atualizado',
      data: { Codigo: '1004', ValorVenda: 320000, Status: 'Vendido' },
    });

    const imoveis = await auditImoveisRepo.listByOrg(t.db, ORG);
    expect(imoveis).toHaveLength(1);
    expect(Number(imoveis[0]!.valor)).toBe(320000);
    expect(imoveis[0]!.status).toBe('vendido');
  });

  it('ignora payload de imóvel sem Codigo mas ainda registra o evento', async () => {
    await processVistaEvent(t.db, ORG, {
      event_type: 'imovel.criado',
      data: { Categoria: 'Casa' },
    });
    expect(await auditImoveisRepo.listByOrg(t.db, ORG)).toHaveLength(0);
    expect(await auditEventosRepo.listByOrg(t.db, ORG)).toHaveLength(1);
  });
});

describe('processVistaEvent — lead.criado/atualizado (e cliente.*)', () => {
  it('cria lead vinculando imóvel e corretor por vista_id', async () => {
    // Primeiro o imóvel com corretor (auto-criado).
    await processVistaEvent(t.db, ORG, {
      event_type: 'imovel.criado',
      data: {
        Codigo: '2001',
        CodigoCorretor: 'C-10',
        Corretor: { Nome: 'Maria', Creci: 'CRECI-10' },
      },
    });

    await processVistaEvent(t.db, ORG, {
      event_type: 'lead.criado',
      data: {
        Codigo: 'L-1',
        Nome: 'Cliente Teste',
        Email: 'cliente@mail.com',
        Celular: '41999990000',
        CodigoCorretor: 'C-10',
        CodigoImovel: '2001',
        Origem: 'Portal',
        ValorProposta: 480000,
      },
    });

    const leads = await auditLeadsRepo.listByOrg(t.db, ORG);
    expect(leads).toHaveLength(1);
    const lead = leads[0]!;
    expect(lead.vistaId).toBe('L-1');
    expect(lead.nome).toBe('Cliente Teste');
    // Celular usado como fallback de telefone.
    expect(lead.telefone).toBe('41999990000');
    expect(lead.origem).toBe('portal');
    expect(lead.status).toBe('novo');
    expect(Number(lead.valorProposta)).toBe(480000);

    const imovel = await auditImoveisRepo.findByVistaId(t.db, ORG, '2001');
    expect(lead.imovelId).toBe(imovel!.id);
    const corretores = await auditCorretoresRepo.listByOrg(t.db, ORG);
    expect(lead.corretorId).toBe(corretores[0]!.id);
  });

  it('lead com corretor/imóvel desconhecidos fica sem vínculos (null)', async () => {
    await processVistaEvent(t.db, ORG, {
      event_type: 'cliente.criado',
      data: { Codigo: 'L-2', CodigoCorretor: 'NAO-EXISTE', CodigoImovel: 'NAO-EXISTE' },
    });
    const leads = await auditLeadsRepo.listByOrg(t.db, ORG);
    expect(leads).toHaveLength(1);
    expect(leads[0]!.corretorId).toBeNull();
    expect(leads[0]!.imovelId).toBeNull();
  });

  it('lead.atualizado é idempotente por vista_id', async () => {
    await processVistaEvent(t.db, ORG, {
      event_type: 'lead.criado',
      data: { Codigo: 'L-3', Status: 'Novo' },
    });
    await processVistaEvent(t.db, ORG, {
      event_type: 'lead.atualizado',
      data: { Codigo: 'L-3', Status: 'Em atendimento' },
    });
    const leads = await auditLeadsRepo.listByOrg(t.db, ORG);
    expect(leads).toHaveLength(1);
    expect(leads[0]!.status).toBe('em atendimento');
  });
});

describe('processVistaEvent — negocio.criado/atualizado', () => {
  it('cria negócio vinculando imóvel, lead e corretor por vista_id', async () => {
    await processVistaEvent(t.db, ORG, {
      event_type: 'imovel.criado',
      data: {
        Codigo: '3001',
        CodigoCorretor: 'C-20',
        Corretor: { Nome: 'Pedro', Creci: 'CRECI-20' },
      },
    });
    await processVistaEvent(t.db, ORG, {
      event_type: 'lead.criado',
      data: { Codigo: 'L-30', CodigoImovel: '3001' },
    });
    await processVistaEvent(t.db, ORG, {
      event_type: 'negocio.criado',
      data: {
        Codigo: 'N-1',
        CodigoCliente: 'L-30',
        CodigoImovel: '3001',
        CodigoCorretor: 'C-20',
        ValorVenda: 450000,
        ComissaoPercentual: 6,
        ComissaoValor: 27000,
        DataFechamento: '2026-06-01T12:00:00Z',
        Status: 'Fechado',
        Observacoes: 'venda direta',
      },
    });

    const negocios = await auditNegociosRepo.listByOrg(t.db, ORG);
    expect(negocios).toHaveLength(1);
    const n = negocios[0]!;
    expect(n.vistaId).toBe('N-1');
    expect(Number(n.valorVenda)).toBe(450000);
    expect(Number(n.comissaoPercentual)).toBe(6);
    expect(Number(n.comissaoValor)).toBe(27000);
    expect(n.dataFechamento?.toISOString()).toBe('2026-06-01T12:00:00.000Z');
    expect(n.status).toBe('fechado');
    expect(n.observacoes).toBe('venda direta');

    const imovel = await auditImoveisRepo.findByVistaId(t.db, ORG, '3001');
    expect(n.imovelId).toBe(imovel!.id);
    const leads = await auditLeadsRepo.listByOrg(t.db, ORG);
    expect(n.leadId).toBe(leads[0]!.id);
    const corretores = await auditCorretoresRepo.listByOrg(t.db, ORG);
    expect(n.corretorId).toBe(corretores[0]!.id);
  });

  it('negócio sem data de fechamento e sem vínculos é aceito', async () => {
    await processVistaEvent(t.db, ORG, {
      event_type: 'negocio.criado',
      data: { Codigo: 'N-2' },
    });
    const negocios = await auditNegociosRepo.listByOrg(t.db, ORG);
    expect(negocios).toHaveLength(1);
    expect(negocios[0]!.dataFechamento).toBeNull();
    expect(negocios[0]!.status).toBe('pendente');
  });

  it('descarta DataFechamento inválida sem quebrar', async () => {
    await processVistaEvent(t.db, ORG, {
      event_type: 'negocio.criado',
      data: { Codigo: 'N-3', DataFechamento: 'nao-e-data' },
    });
    const negocios = await auditNegociosRepo.listByOrg(t.db, ORG);
    expect(negocios[0]!.dataFechamento).toBeNull();
  });
});

describe('processVistaEvent — log de eventos e isolamento multi-tenant', () => {
  it('registra todo evento em audit_eventos com fonte vista_webhook', async () => {
    const payload = {
      event_type: 'imovel.criado' as const,
      data: { Codigo: '4001' },
    };
    await processVistaEvent(t.db, ORG, payload);

    const eventos = await auditEventosRepo.listByOrg(t.db, ORG);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]!.tipo).toBe('imovel.criado');
    expect(eventos[0]!.fonte).toBe('vista_webhook');
    expect(eventos[0]!.dados).toEqual(payload);
  });

  it('mesmo vista_id em orgs diferentes gera linhas separadas (isolamento)', async () => {
    await processVistaEvent(t.db, ORG, {
      event_type: 'imovel.criado',
      data: { Codigo: '5001', ValorVenda: 100 },
    });
    await processVistaEvent(t.db, ORG_B, {
      event_type: 'imovel.criado',
      data: { Codigo: '5001', ValorVenda: 200 },
    });

    const a = await auditImoveisRepo.findByVistaId(t.db, ORG, '5001');
    const b = await auditImoveisRepo.findByVistaId(t.db, ORG_B, '5001');
    expect(a!.id).not.toBe(b!.id);
    expect(Number(a!.valor)).toBe(100);
    expect(Number(b!.valor)).toBe(200);
  });

  it('corretor de uma org não é vinculado a lead de outra org', async () => {
    await processVistaEvent(t.db, ORG, {
      event_type: 'imovel.criado',
      data: {
        Codigo: '6001',
        CodigoCorretor: 'C-X',
        Corretor: { Nome: 'Ana', Creci: 'CRECI-X' },
      },
    });
    await processVistaEvent(t.db, ORG_B, {
      event_type: 'lead.criado',
      data: { Codigo: 'L-X', CodigoCorretor: 'C-X' },
    });

    const leads = await auditLeadsRepo.listByOrg(t.db, ORG_B);
    expect(leads[0]!.corretorId).toBeNull();
  });
});
