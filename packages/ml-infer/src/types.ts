// Tipos do pacote de inferência AVM.
// EstimateInput é um subset de NormalizedListing suficiente para construir o vetor de features.

import type { InferenceSession } from 'onnxruntime-node';

/**
 * Tipo de imóvel suportado pelo modelo — deve espelhar exatamente as categorias
 * usadas no treino em `ml-training/src/imovi_training/features/builder.py`.
 */
export type PropertyType = 'apartment' | 'house' | 'commercial' | 'land';

/**
 * Entrada mínima para estimar preço — espelha campos relevantes de NormalizedListing.
 * Campos numéricos são nullable para permitir imputação usando medianas do artefato.
 */
export interface EstimateInput {
  area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  propertyType: PropertyType;
}

/**
 * Saída da estimativa com intervalo de confiança simples (baseado em bps).
 * featuresUsed expõe as features efetivamente enviadas ao modelo (pós-imputação)
 * para auditabilidade/explainability.
 */
export interface EstimateOutput {
  estimate: number;
  confidenceLow: number;
  confidenceHigh: number;
  modelVersion: string;
  featuresUsed: Record<string, number>;
}

/**
 * Metadata serializada junto com o .onnx (sidecar JSON).
 * featureOrder define a ordem exata esperada pelo modelo.
 * imputationMedians: medianas calculadas no treino (nunca em runtime).
 * categories: ordem canônica do one-hot de property_type.
 */
export interface ModelMetadata {
  modelVersion: string;
  featureOrder: string[];
  imputationMedians: Record<string, number>;
  categories: string[];
}

/**
 * Artefato carregado: sessão ONNX + metadata validada.
 */
export interface ModelArtifact {
  session: InferenceSession;
  metadata: ModelMetadata;
}
