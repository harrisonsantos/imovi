/**
 * Testes do limite de corretores na ingestão (Fase 8a — monetização).
 *
 * Política "warn, don't drop": criar um corretor NOVO acima de maxCorretores
 * NÃO bloqueia a criação — o corretor é criado normalmente, mas um evento
 * 'limite_corretores_excedido' é registrado em audit_eventos e o resultado
 * sinaliza limitWarning para a rota do webhook expor na resposta.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { auditCorretoresRepo, auditEventosRepo } from '@imovi/db/audit';
import { processVistaEvent } from '../src/ingest.js';
import { createTestDb, type TestDb } from './setup.js';

const ORG = 'org_limite_1';

let t: TestDb;

beforeEach(async () => {
  t = await createTestDb();
});

afterEach(async () => {
  await t.dispose();
});

function imovelComCorretor(codigo: string, creci: string, nome: string) {
  return {
    event_type: 'imovel.criado' as const,
    data: {
      Codigo: codigo,
      CodigoCorretor: `C-${creci}`,
      Corretor: { Nome: nome, Creci: creci },
    },
  };
}

async function eventosLimite() {
  const eventos = await auditEventosRepo.listByOrg(t.db, ORG);
  return eventos.filter((e) => e.tipo === 'limite_corretores_excedido');
}

describe('processVistaEvent — limite de corretores (maxCorretores)', () => {
  it('dentro do limite: cria corretor sem evento de limite e sem limitWarning', async () => {
    const result = await processVistaEvent(t.db, ORG, imovelComCorretor('1', 'CRECI-1', 'Ana'), {
      maxCorretores: 5,
    });

    expect((await auditCorretoresRepo.listByOrg(t.db, ORG)).length).toBe(1);
    expect(await eventosLimite()).toHaveLength(0);
    expect(result.limitWarning).toBe(false);
  });

  it('acima do limite: ainda cria o corretor, mas registra evento e sinaliza limitWarning', async () => {
    await processVistaEvent(t.db, ORG, imovelComCorretor('1', 'CRECI-1', 'Ana'), {
      maxCorretores: 1,
    });
    const result = await processVistaEvent(
      t.db,
      ORG,
      imovelComCorretor('2', 'CRECI-2', 'Beto'),
      { maxCorretores: 1 },
    );

    // warn, don't drop: o corretor excedente FOI criado.
    expect((await auditCorretoresRepo.listByOrg(t.db, ORG)).length).toBe(2);
    expect(result.limitWarning).toBe(true);

    const limites = await eventosLimite();
    expect(limites).toHaveLength(1);
    expect(limites[0]!.fonte).toBe('vista_webhook');
  });

  it('atualizar corretor existente no limite NÃO dispara o aviso (só criação)', async () => {
    await processVistaEvent(t.db, ORG, imovelComCorretor('1', 'CRECI-1', 'Ana'), {
      maxCorretores: 1,
    });
    // Mesmo Creci → upsert atualiza em vez de criar.
    const result = await processVistaEvent(
      t.db,
      ORG,
      imovelComCorretor('2', 'CRECI-1', 'Ana Atualizada'),
      { maxCorretores: 1 },
    );

    expect((await auditCorretoresRepo.listByOrg(t.db, ORG)).length).toBe(1);
    expect(await eventosLimite()).toHaveLength(0);
    expect(result.limitWarning).toBe(false);
  });

  it('sem maxCorretores (null/ausente): nunca registra evento de limite', async () => {
    await processVistaEvent(t.db, ORG, imovelComCorretor('1', 'CRECI-1', 'Ana'), {
      maxCorretores: null,
    });
    const result = await processVistaEvent(t.db, ORG, imovelComCorretor('2', 'CRECI-2', 'Beto'));

    expect((await auditCorretoresRepo.listByOrg(t.db, ORG)).length).toBe(2);
    expect(await eventosLimite()).toHaveLength(0);
    expect(result.limitWarning).toBe(false);
  });
});
