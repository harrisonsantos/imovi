// Carregamento do artefato ONNX + metadata sidecar.
// sessionFactory é injetável para permitir mock nos testes sem carregar onnxruntime real.

import { z } from 'zod';
import type {
  MinimalInferenceSession,
  ModelArtifact,
  ModelMetadata,
} from './types.js';

// Schema zod para validar o sidecar JSON.
const ModelMetadataSchema = z.object({
  modelVersion: z.string().min(1),
  featureOrder: z.array(z.string().min(1)).min(1),
  imputationMedians: z.record(z.string(), z.number()),
  categories: z.array(z.string().min(1)).min(1),
});

export type SessionFactory = (onnxBytes: Uint8Array) => Promise<MinimalInferenceSession>;

export interface LoadOptions {
  /** Factory para criar a InferenceSession — default usa onnxruntime-node. */
  sessionFactory?: SessionFactory;
}

/**
 * Factory default que importa dinamicamente onnxruntime-node (Node/Worker).
 * Dinâmico porque (a) permite stub em tests, (b) evita custo de import em
 * workers que nunca fazem inferência, (c) mantém o bundle edge limpo — o
 * edge usa `createWebSessionFactory()` (subpath `@imovi/ml-infer/load-web`).
 */
const defaultSessionFactory: SessionFactory = async (onnxBytes) => {
  const ort = await import('onnxruntime-node');
  return (await ort.InferenceSession.create(onnxBytes)) as unknown as MinimalInferenceSession;
};

/**
 * Carrega o modelo AVM: valida metadata via zod e instancia a InferenceSession.
 * Lança se metadata for inválida.
 */
export async function loadModel(
  onnxBytes: Uint8Array,
  metadataJson: string,
  opts: LoadOptions = {},
): Promise<ModelArtifact> {
  const parsed: unknown = JSON.parse(metadataJson);
  const metadata: ModelMetadata = ModelMetadataSchema.parse(parsed);

  const factory = opts.sessionFactory ?? defaultSessionFactory;
  const session = await factory(onnxBytes);

  return { session, metadata };
}
