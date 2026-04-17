/**
 * SessionFactory baseada em `onnxruntime-web` (WASM).
 *
 * Usado no edge runtime do Cloudflare Pages, onde `onnxruntime-node`
 * não funciona (módulo nativo N-API). Import é dinâmico pra não
 * vazar `onnxruntime-web` pro bundle de quem só quer a heurística.
 */

import { loadModel, type LoadOptions, type SessionFactory } from './load.js';
import type { ModelArtifact } from './types.js';

/**
 * Cria uma SessionFactory que instancia `ort.InferenceSession` via
 * onnxruntime-web. `wasmBaseUrl` customiza `ort.env.wasm.wasmPaths` —
 * essencial no edge, que não serve binários estáticos por padrão.
 * Default aponta pro CDN oficial Microsoft/jsdelivr.
 */
export function createWebSessionFactory(
  opts: { wasmBaseUrl?: string } = {},
): SessionFactory {
  const wasmBaseUrl =
    opts.wasmBaseUrl ?? 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.0/dist/';
  return async (onnxBytes) => {
    const ort = await import('onnxruntime-web');
    // `env.wasm` é global; setar uma vez é suficiente, mas sobrescrever é idempotente.
    ort.env.wasm.wasmPaths = wasmBaseUrl;
    ort.env.wasm.numThreads = 1;
    const session = await ort.InferenceSession.create(onnxBytes, {
      executionProviders: ['wasm'],
    });
    return session;
  };
}

/** Atalho para edge: carrega .onnx + metadata usando WASM runtime. */
export async function loadModelWeb(
  onnxBytes: Uint8Array,
  metadataJson: string,
  opts: LoadOptions & { wasmBaseUrl?: string } = {},
): Promise<ModelArtifact> {
  return loadModel(onnxBytes, metadataJson, {
    sessionFactory: opts.sessionFactory ?? createWebSessionFactory({ wasmBaseUrl: opts.wasmBaseUrl }),
  });
}
