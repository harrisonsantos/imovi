/**
 * Detector: valor de venda declarado destoa da estimativa AVM (sinergia com
 * o estimador de preços — possível subfaturamento/lavagem quando muito abaixo).
 *
 * DECISÃO DE IMPLEMENTAÇÃO (caminho da estimativa):
 *   O `estimateHeuristic` de @imovi/ml-infer exige `areaM2` e `propertyType`,
 *   campos que `audit_imoveis` NÃO possui (só endereco/tipo/valor) — e
 *   @imovi/audit não declara @imovi/ml-infer como dependência. Por isso a
 *   estimativa é interna e pura, em duas vias:
 *     1. `areaM2` (opcional, fornecida pelo chamador quando conhecida):
 *        estimativa = medianPriceM2 do bairro × areaM2;
 *     2. fallback: estimativa = `imovel.valor` (preço de anúncio) — o desvio
 *        passa a medir venda declarada vs. anúncio, ainda condicionado à
 *        cobertura AVM do bairro (match por substring, sem acento/caixa).
 *   Sem imóvel, sem valorVenda, sem bairro casado, sem medianPriceM2 ou sem
 *   base de estimativa → o negócio é PULADO (nenhuma anomalia).
 */
import type { AuditImovel, AuditNegocio } from '@imovi/db/schema-audit';
import type { DetectedAnomalia } from './types.js';

/** Forma mínima da tabela `neighborhoods` do AVM (packages/db/src/schema.ts). */
export interface NeighborhoodRef {
  name: string;
  city: string;
  state: string;
  medianPriceM2: string | number | null;
}

export interface NegocioComImovelRef {
  negocio: AuditNegocio;
  imovel: AuditImovel | null;
  /** Área útil em m², quando conhecida pelo chamador (audit_imoveis não a possui). */
  areaM2?: number | null;
}

export interface DesvioAvmOpts {
  /** Desvio percentual tolerado antes de sinalizar (ex.: 25 → 25%). */
  deviationPct: number;
}

/** Abaixo de 60% da estimativa (>40% de desconto) → severidade alta. */
const LIMIAR_SUBFATURAMENTO = 0.4;

/** Normaliza para comparação: minúsculas e sem diacríticos (Workers-safe). */
const normalizar = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Converte numeric do Drizzle (string) ou number em número positivo, senão null. */
const parsePositivo = (v: string | number | null | undefined): number | null => {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Encontra o bairro AVM cujo nome aparece no endereço (prefere o nome mais longo). */
const matchNeighborhood = (
  endereco: string,
  neighborhoods: NeighborhoodRef[],
): NeighborhoodRef | null => {
  const end = normalizar(endereco);
  let melhor: NeighborhoodRef | null = null;
  for (const n of neighborhoods) {
    const nome = normalizar(n.name);
    if (nome.length === 0 || !end.includes(nome)) continue;
    if (melhor == null || nome.length > normalizar(melhor.name).length) melhor = n;
  }
  return melhor;
};

export function detectDesvioAvm(
  negociosComImovel: NegocioComImovelRef[],
  neighborhoods: NeighborhoodRef[],
  opts: DesvioAvmOpts,
): DetectedAnomalia[] {
  const anomalias: DetectedAnomalia[] = [];

  for (const { negocio, imovel, areaM2 } of negociosComImovel) {
    if (imovel == null || imovel.endereco == null) continue;

    const valorVenda = parsePositivo(negocio.valorVenda);
    if (valorVenda == null) continue;

    const bairro = matchNeighborhood(imovel.endereco, neighborhoods);
    if (bairro == null) continue;

    const medianPriceM2 = parsePositivo(bairro.medianPriceM2);
    if (medianPriceM2 == null) continue;

    // Via 1: mediana do bairro × área; via 2 (fallback): preço de anúncio.
    const area = parsePositivo(areaM2);
    const estimate = area != null ? medianPriceM2 * area : parsePositivo(imovel.valor);
    if (estimate == null) continue;

    const desvioPct = (Math.abs(valorVenda - estimate) / estimate) * 100;
    if (desvioPct <= opts.deviationPct) continue;

    const subfaturado = valorVenda < estimate * (1 - LIMIAR_SUBFATURAMENTO);
    anomalias.push({
      tipo: 'desvio_avm',
      severidade: subfaturado ? 'alta' : 'media',
      corretorId: negocio.corretorId,
      entidadeTipo: 'negocio',
      entidadeId: negocio.id,
      descricao: subfaturado
        ? `Venda declarada R$ ${valorVenda.toLocaleString('pt-BR')} muito abaixo da estimativa AVM R$ ${Math.round(estimate).toLocaleString('pt-BR')} (desvio ${desvioPct.toFixed(1)}%) — possível subfaturamento`
        : `Venda declarada R$ ${valorVenda.toLocaleString('pt-BR')} destoa da estimativa AVM R$ ${Math.round(estimate).toLocaleString('pt-BR')} (desvio ${desvioPct.toFixed(1)}%)`,
      dadosContexto: {
        estimate,
        valorVenda,
        desvioPct,
        bairro: bairro.name,
      },
    });
  }

  return anomalias;
}
