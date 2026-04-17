/**
 * Carregamento do modelo AVM (ONNX) a partir do bucket R2 `MODEL_ARTIFACTS`.
 *
 * Convenção de layout no bucket:
 *   current/model.onnx             ← binário ONNX
 *   current/model.onnx.metadata.json ← sidecar JSON (contrato ml-infer)
 *
 * Edge runtime: usa `onnxruntime-web` (WASM) via subpath `@imovi/ml-infer/load-web`.
 * Cache em memória por instância (CF mantém o isolate vivo entre requests),
 * reduzindo latência do 2º request em diante.
 */
import type { ModelArtifact, EstimateInput, EstimateOutput } from '@imovi/ml-infer';
import { estimate } from '@imovi/ml-infer/infer';
import { loadModelWeb } from '@imovi/ml-infer/load-web';

export interface R2ModelBindings {
  MODEL_ARTIFACTS?: R2Bucket;
}

const MODEL_OBJECT_KEY = 'current/model.onnx';
const METADATA_OBJECT_KEY = 'current/model.onnx.metadata.json';

// Cache in-isolate. `null` = tentou e falhou; `undefined` = ainda não tentou.
let cachedArtifact: ModelArtifact | null | undefined;

export function clearModelCache(): void {
  cachedArtifact = undefined;
}

/**
 * Tenta carregar o artefato do R2. Retorna `null` se:
 *   - binding ausente
 *   - objeto não existe no bucket
 *   - metadata malformada
 *   - runtime WASM falha ao inicializar
 *
 * Callers devem fazer fallback pra heurística em caso de `null`.
 */
export async function getModelArtifact(
  env: R2ModelBindings,
): Promise<ModelArtifact | null> {
  if (cachedArtifact !== undefined) return cachedArtifact;

  const bucket = env.MODEL_ARTIFACTS;
  if (!bucket) {
    cachedArtifact = null;
    return null;
  }

  try {
    const [onnxObj, metaObj] = await Promise.all([
      bucket.get(MODEL_OBJECT_KEY),
      bucket.get(METADATA_OBJECT_KEY),
    ]);
    if (!onnxObj || !metaObj) {
      cachedArtifact = null;
      return null;
    }
    const [onnxBytes, metaJson] = await Promise.all([
      onnxObj.arrayBuffer(),
      metaObj.text(),
    ]);
    const artifact = await loadModelWeb(new Uint8Array(onnxBytes), metaJson);
    cachedArtifact = artifact;
    return artifact;
  } catch {
    // Qualquer falha → cache null pra não re-tentar todo request
    cachedArtifact = null;
    return null;
  }
}

/** Atalho estimate com artefato do R2. `null` = deve usar heurística. */
export async function tryEstimateWithModel(
  env: R2ModelBindings,
  input: EstimateInput,
): Promise<EstimateOutput | null> {
  const artifact = await getModelArtifact(env);
  if (!artifact) return null;
  try {
    return await estimate(artifact, input);
  } catch {
    return null;
  }
}
