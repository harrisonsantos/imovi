// Construção do vetor de features — espelha ml-training/src/imovi_training/features/builder.py.
// Imputação usa SOMENTE medianas do artefato (determinístico, zero-drift com treino).

import type { EstimateInput, ModelMetadata } from './types.js';

/**
 * Resolve um campo numérico aplicando imputação pela mediana do artefato
 * quando o valor é null/undefined.
 */
function imputeNumeric(
  value: number | null | undefined,
  key: string,
  medians: Record<string, number>,
): number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    const median = medians[key];
    if (median === undefined) {
      throw new Error(`Mediana de imputação ausente para feature '${key}'`);
    }
    return median;
  }
  return value;
}

/**
 * Constrói o vetor de features na ordem exata definida em metadata.featureOrder.
 * Retorna [Float32Array para o runtime ONNX, dict com nomes humanos para explainability].
 *
 * Convenções de nomes de feature (devem bater com o treino):
 *  - numéricas: area_m2, bedrooms, bathrooms, parking
 *  - one-hot: property_type_<category>
 */
export function buildFeatureVector(
  input: EstimateInput,
  metadata: ModelMetadata,
): [Float32Array, Record<string, number>] {
  const medians = metadata.imputationMedians;

  // Mapeamento de nome canônico de feature -> valor (antes de respeitar featureOrder).
  const feats: Record<string, number> = {
    area_m2: imputeNumeric(input.area, 'area_m2', medians),
    bedrooms: imputeNumeric(input.bedrooms, 'bedrooms', medians),
    bathrooms: imputeNumeric(input.bathrooms, 'bathrooms', medians),
    parking: imputeNumeric(input.parking, 'parking', medians),
  };

  // Feature de localização (modelo v2+): só entra se o artefato a espera —
  // mantém compatibilidade com modelos v1 sem ela.
  if (metadata.featureOrder.includes('neighborhood_median_price_m2')) {
    feats['neighborhood_median_price_m2'] = imputeNumeric(
      input.neighborhoodMedianPriceM2,
      'neighborhood_median_price_m2',
      medians,
    );
  }

  // One-hot estável na ordem de metadata.categories.
  for (const cat of metadata.categories) {
    feats[`property_type_${cat}`] = input.propertyType === cat ? 1 : 0;
  }

  // Monta Float32Array na ordem exata do modelo.
  const vec = new Float32Array(metadata.featureOrder.length);
  for (let i = 0; i < metadata.featureOrder.length; i++) {
    const name = metadata.featureOrder[i]!;
    const v = feats[name];
    if (v === undefined) {
      throw new Error(`Feature '${name}' em featureOrder não foi produzida`);
    }
    vec[i] = v;
  }

  return [vec, feats];
}
