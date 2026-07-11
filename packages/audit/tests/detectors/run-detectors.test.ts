import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  auditAnomaliasRepo,
  auditCorretoresRepo,
  auditImoveisRepo,
  auditLeadsRepo,
  auditNegociosRepo,
} from '@imovi/db/audit';
import { runDetectors } from '../../src/detectors/run-detectors.js';
import { createTestDb, type TestDb } from '../setup-detectors.js';

const ORG = 'org-detectores';
const DIA_MS = 24 * 60 * 60 * 1000;

describe('runDetectors (integração pglite)', () => {
  let t: TestDb;

  beforeEach(async () => {
    t = await createTestDb();
  });

  afterEach(async () => {
    await t.dispose();
  });

  /**
   * Semeia um cenário com 5 tipos de anomalia:
   *   - lead perdido logo após criação (repos forçam created/updated = now);
   *   - lead "novo" inativo (avaliado com `now` 40 dias à frente);
   *   - imóvel vendido sem negócio;
   *   - negócio com data de fechamento futura;
   *   - negócio fechado muito abaixo da estimativa AVM (desvio_avm).
   */
  async function seed() {
    const corretor = await auditCorretoresRepo.upsertByCreci(t.db, ORG, {
      nome: 'Maria Corretora',
      creci: 'CRECI-1',
    });

    // Lead perdido imediatamente após a criação → lead_perdido_rapido
    await auditLeadsRepo.upsertByVistaId(t.db, ORG, {
      vistaId: 'L-perdido',
      nome: 'João',
      status: 'perdido',
      corretorId: corretor.id,
    });

    // Lead novo que ficará 40 dias sem atualização → lead_inativo
    await auditLeadsRepo.upsertByVistaId(t.db, ORG, {
      vistaId: 'L-inativo',
      nome: 'Antigo',
      status: 'novo',
      corretorId: corretor.id,
    });

    // Imóvel vendido sem negócio → venda_nao_registrada
    await auditImoveisRepo.upsertByVistaId(t.db, ORG, {
      vistaId: 'I-vendido',
      endereco: 'Rua Sem Negócio, 1',
      status: 'vendido',
      corretorId: corretor.id,
    });

    // Imóvel anunciado por 500k no Batel, vendido por 200k → desvio_avm (alta)
    const imovelBatel = await auditImoveisRepo.upsertByVistaId(t.db, ORG, {
      vistaId: 'I-batel',
      endereco: 'Av. do Batel, 1000 - Batel, Curitiba/PR',
      valor: '500000.00',
      status: 'vendido',
    });
    await auditNegociosRepo.upsertByVistaId(t.db, ORG, {
      vistaId: 'N-subfaturado',
      imovelId: imovelBatel.id,
      valorVenda: '200000.00',
      dataFechamento: new Date(),
      status: 'concluído',
      corretorId: corretor.id,
    });

    // Negócio com fechamento 60 dias no futuro (além do `now` de teste) → negocio_data_futura
    await auditNegociosRepo.upsertByVistaId(t.db, ORG, {
      vistaId: 'N-futuro',
      valorVenda: '300000.00',
      dataFechamento: new Date(Date.now() + 60 * DIA_MS),
      corretorId: corretor.id,
    });
  }

  const fetchNeighborhoods = async () => [
    { name: 'Batel', city: 'Curitiba', state: 'PR', medianPriceM2: '10000.00' },
  ];

  it('deve rodar todos os detectores e persistir as anomalias', async () => {
    await seed();

    // `now` 40 dias à frente: ativa lead_inativo sem precisar mexer em updated_at
    const now = new Date(Date.now() + 40 * DIA_MS);
    const result = await runDetectors(t.db, ORG, { now, fetchNeighborhoods });

    expect(result.detected).toBeGreaterThanOrEqual(4);
    expect(result.inserted).toBe(result.detected);

    const anomalias = await auditAnomaliasRepo.listByOrg(t.db, ORG);
    const tipos = anomalias.map((a) => a.tipo);
    expect(tipos).toContain('lead_inativo');
    expect(tipos).toContain('venda_nao_registrada');
    expect(tipos).toContain('negocio_data_futura');
    expect(tipos).toContain('desvio_avm');

    const desvio = anomalias.find((a) => a.tipo === 'desvio_avm')!;
    expect(desvio.severidade).toBe('alta');
  });

  it('deve detectar lead_perdido_rapido quando avaliado logo após o sync', async () => {
    await seed();

    // `now` real: o lead perdido acabou de ser criado/atualizado (< 24h)
    const result = await runDetectors(t.db, ORG, { now: new Date(), fetchNeighborhoods });
    expect(result.detected).toBeGreaterThanOrEqual(1);

    const anomalias = await auditAnomaliasRepo.listByOrg(t.db, ORG, {
      tipo: 'lead_perdido_rapido',
    });
    expect(anomalias).toHaveLength(1);
    expect(anomalias[0]!.severidade).toBe('media');
  });

  it('não deve duplicar anomalias não resolvidas em re-execuções (dedupe do repo)', async () => {
    await seed();
    const now = new Date(Date.now() + 40 * DIA_MS);

    const primeira = await runDetectors(t.db, ORG, { now, fetchNeighborhoods });
    const segunda = await runDetectors(t.db, ORG, { now, fetchNeighborhoods });

    expect(primeira.inserted).toBeGreaterThan(0);
    expect(segunda.detected).toBe(primeira.detected);
    expect(segunda.inserted).toBe(0);
  });

  it('deve funcionar sem fetchNeighborhoods (desvio_avm é pulado)', async () => {
    await seed();

    const result = await runDetectors(t.db, ORG, { now: new Date() });
    expect(result.inserted).toBeGreaterThan(0);

    const desvios = await auditAnomaliasRepo.listByOrg(t.db, ORG, { tipo: 'desvio_avm' });
    expect(desvios).toHaveLength(0);
  });

  it('deve retornar zero em org sem dados', async () => {
    const result = await runDetectors(t.db, 'org-vazia', { fetchNeighborhoods });
    expect(result).toEqual({ detected: 0, inserted: 0 });
  });
});
