/** Load active immutable AVM artifacts, with bounded isolate caching. */
import type { ModelArtifact, EstimateInput, EstimateOutput } from '@imovi/ml-infer';
import { createDbClient, modelVersionRepo } from '@imovi/db';
import { estimate } from '@imovi/ml-infer/infer';
import { loadModelWeb, createWebSessionFactory } from '@imovi/ml-infer/load-web';

export interface R2ModelBindings {
  MODEL_ARTIFACTS?: R2Bucket;
  DATABASE_URL?: string;
}

const SUCCESS_TTL_MS = 5 * 60_000;
const FAILURE_TTL_MS = 30_000;
let cache:
  | { bucket?: R2Bucket; databaseUrl?: string; expiresAt: number; artifact: ModelArtifact | null }
  | undefined;
let pending:
  | { bucket?: R2Bucket; databaseUrl?: string; promise: Promise<ModelArtifact | null> }
  | undefined;
let generation = 0;

export function clearModelCache(): void {
  cache = undefined;
  pending = undefined;
  generation += 1;
}

async function loadActiveModel(env: R2ModelBindings): Promise<ModelArtifact | null> {
  const bucket = env.MODEL_ARTIFACTS;
  if (!bucket || !env.DATABASE_URL) return null;
  try {
    const active = await modelVersionRepo.getActive(
      createDbClient({ connectionString: env.DATABASE_URL }),
    );
    if (!active?.artifactUrl || !/^[a-zA-Z0-9._-]+$/.test(active.version)) return null;
    const key = `versions/${active.version}/model.onnx`;
    // Reject mutable current/ paths and artifacts from another version.
    if (
      !active.artifactUrl.startsWith('r2://') ||
      active.artifactUrl.split('/').slice(3).join('/') !== key
    )
      return null;
    const [onnxObj, metaObj] = await Promise.all([
      bucket.get(key),
      bucket.get(`${key}.metadata.json`),
    ]);
    if (!onnxObj || !metaObj) return null;
    const [bytes, metadata] = await Promise.all([onnxObj.arrayBuffer(), metaObj.text()]);
    const artifact = await loadModelWeb(new Uint8Array(bytes), metadata);
    if (artifact.metadata.modelVersion !== active.version) return null;
    try {
      const prefix = key.slice(0, -'model.onnx'.length);
      const [p10Obj, p90Obj] = await Promise.all([
        bucket.get(`${prefix}model-p10.onnx`),
        bucket.get(`${prefix}model-p90.onnx`),
      ]);
      if (p10Obj && p90Obj) {
        const factory = createWebSessionFactory();
        const [p10Bytes, p90Bytes] = await Promise.all([
          p10Obj.arrayBuffer(),
          p90Obj.arrayBuffer(),
        ]);
        const [p10, p90] = await Promise.all([
          factory(new Uint8Array(p10Bytes)),
          factory(new Uint8Array(p90Bytes)),
        ]);
        artifact.quantileSessions = { p10, p90 };
      }
    } catch {
      // The p50 model remains usable without optional interval artifacts.
    }
    return artifact;
  } catch {
    return null;
  }
}

export async function getModelArtifact(env: R2ModelBindings): Promise<ModelArtifact | null> {
  if (
    cache &&
    cache.bucket === env.MODEL_ARTIFACTS &&
    cache.databaseUrl === env.DATABASE_URL &&
    Date.now() < cache.expiresAt
  ) {
    return cache.artifact;
  }
  if (pending && pending.bucket === env.MODEL_ARTIFACTS && pending.databaseUrl === env.DATABASE_URL)
    return pending.promise;
  const startedGeneration = generation;
  const promise = loadActiveModel(env).then((artifact) => {
    if (generation === startedGeneration) {
      cache = {
        bucket: env.MODEL_ARTIFACTS,
        databaseUrl: env.DATABASE_URL,
        artifact,
        expiresAt: Date.now() + (artifact ? SUCCESS_TTL_MS : FAILURE_TTL_MS),
      };
    }
    return artifact;
  });
  const entry = { bucket: env.MODEL_ARTIFACTS, databaseUrl: env.DATABASE_URL, promise };
  pending = entry;
  try {
    return await promise;
  } finally {
    if (pending === entry) pending = undefined;
  }
}

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
