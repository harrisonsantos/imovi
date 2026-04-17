/**
 * Estimador heurístico v0 — baseline determinístico para o MVP.
 *
 * Não substitui o modelo ONNX (`estimate()` em infer.ts). Existe em paralelo
 * para permitir respostas imediatas enquanto o modelo ML não foi treinado.
 *
 * Fórmula: `priceM2 * area * multiplicadores`. Multiplicadores são cumulativos.
 * Intervalo de confiança fixo em ±30% — a heurística é grosseira e o output
 * deve refletir isso honestamente ao usuário final.
 */

import type { PropertyType } from './types.js';

export interface HeuristicInput {
  /** Mediana R$/m² do bairro, vinda do DB. */
  neighborhoodPriceM2: number;
  /** Área útil em m². */
  areaM2: number;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  propertyType: PropertyType;
}

export interface HeuristicOutput {
  estimate: number;
  confidenceLow: number;
  confidenceHigh: number;
  modelVersion: 'heuristic-v0';
  /** Valores efetivamente usados no cálculo (pós-default) — auditabilidade. */
  featuresUsed: Record<string, number>;
}

/** Multiplicadores por tipo de imóvel. Baseline = apartamento. */
const TYPE_MULTIPLIERS: Record<PropertyType, number> = {
  apartment: 1.0,
  house: 1.15,
  commercial: 0.9,
  land: 0.5,
};

/** Defaults neutros para campos ausentes (refletem o "apartamento típico 2 quartos"). */
const DEFAULT_BEDROOMS = 2;
const DEFAULT_BATHROOMS = 1;
const DEFAULT_PARKING = 0;

/** Largura do intervalo de confiança (±30%). */
const INTERVAL = 0.3;

export function estimateHeuristic(input: HeuristicInput): HeuristicOutput {
  const { neighborhoodPriceM2, areaM2, propertyType } = input;
  const bedrooms = input.bedrooms ?? DEFAULT_BEDROOMS;
  const bathrooms = input.bathrooms ?? DEFAULT_BATHROOMS;
  const parking = input.parking ?? DEFAULT_PARKING;

  const typeMultiplier = TYPE_MULTIPLIERS[propertyType];
  // Baseline 2 quartos: cada quarto acima/abaixo vale ±4%.
  const bedroomsMultiplier = 1 + (bedrooms - 2) * 0.04;
  // Baseline 1 banheiro: cada banheiro acima vale +3%.
  const bathroomsMultiplier = 1 + (bathrooms - 1) * 0.03;
  // Cada vaga soma 5% sobre o baseline (sem vaga).
  const parkingMultiplier = 1 + parking * 0.05;

  const base = neighborhoodPriceM2 * areaM2;
  const estimate =
    base * typeMultiplier * bedroomsMultiplier * bathroomsMultiplier * parkingMultiplier;

  return {
    estimate,
    confidenceLow: estimate * (1 - INTERVAL),
    confidenceHigh: estimate * (1 + INTERVAL),
    modelVersion: 'heuristic-v0',
    featuresUsed: {
      neighborhoodPriceM2,
      areaM2,
      bedrooms,
      bathrooms,
      parking,
      typeMultiplier,
      bedroomsMultiplier,
      bathroomsMultiplier,
      parkingMultiplier,
    },
  };
}
