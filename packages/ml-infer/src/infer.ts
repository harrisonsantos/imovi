// Execução da inferência ONNX e construção do EstimateOutput.
// Import dinâmico do runtime para permitir mock em testes.

import type { EstimateInput, EstimateOutput, ModelArtifact } from './types.js';
import { buildFeatureVector } from './features.js';

export interface EstimateOptions {
  /**
   * Largura do intervalo de confiança em basis points (1 bp = 0.01%).
   * Default 1500 bps = ±15%.
   *
   * NOTA: intervalo proper (calibrado) virá de quantile regression em fase futura;
   * por ora usamos uma margem fixa para o MVP.
   */
  intervalBps?: number;
}

const DEFAULT_INTERVAL_BPS = 1500;

/**
 * Executa o modelo e devolve estimativa + intervalo simples.
 * - Monta Float32Array via buildFeatureVector
 * - Cria tensor shape [1, featureOrder.length]
 * - Lê o primeiro valor do output (regressor escalar)
 */
/** Roda uma sessão (regressor escalar) sobre o vetor de features. */
async function runScalarSession(
  session: ModelArtifact['session'],
  vec: Float32Array,
  featureCount: number,
): Promise<number> {
  // Import dinâmico de onnxruntime-node — se indisponível (ex.: ambiente de testes
  // sem a dep nativa), caímos num tensor-like mínimo compatível com o shape esperado.
  // Em produção o módulo está sempre presente.
  let tensor: unknown;
  try {
    const ort = await import('onnxruntime-node');
    tensor = new ort.Tensor('float32', vec, [1, featureCount]);
  } catch {
    tensor = { data: vec, dims: [1, featureCount], type: 'float32' };
  }

  // Usa o primeiro input name da sessão; fallback para 'features' se indisponível.
  const sessionInputNames = session.inputNames;
  const inputName =
    sessionInputNames !== undefined && sessionInputNames[0] !== undefined
      ? sessionInputNames[0]
      : 'features';

  // Cast porque aceitamos um tensor-like quando o runtime real não está disponível.
  const feeds = { [inputName]: tensor } as unknown as Parameters<typeof session.run>[0];
  const result = await session.run(feeds);

  // Pega o primeiro output (regressor escalar).
  const sessionOutputNames = session.outputNames;
  const outputName =
    sessionOutputNames !== undefined && sessionOutputNames[0] !== undefined
      ? sessionOutputNames[0]
      : Object.keys(result)[0]!;
  const outTensor = result[outputName];
  if (!outTensor) {
    throw new Error(`Output '${outputName}' ausente no resultado da inferência`);
  }

  const data = outTensor.data as Float32Array | Float64Array | number[];
  const first = data?.[0];
  if (typeof first !== 'number') {
    throw new Error('Saída do modelo vazia ou não numérica');
  }
  return Number(first);
}

export async function estimate(
  artifact: ModelArtifact,
  input: EstimateInput,
  opts: EstimateOptions = {},
): Promise<EstimateOutput> {
  const { session, quantileSessions, metadata } = artifact;
  const [vec, featuresUsed] = buildFeatureVector(input, metadata);
  const n = metadata.featureOrder.length;

  const estimateValue = await runScalarSession(session, vec, n);

  let confidenceLow: number;
  let confidenceHigh: number;
  if (quantileSessions) {
    // Intervalos calibrados via quantile regression (p10/p90).
    const [p10, p90] = await Promise.all([
      runScalarSession(quantileSessions.p10, vec, n),
      runScalarSession(quantileSessions.p90, vec, n),
    ]);
    // Guard contra quantile crossing: ordena e garante que contém a estimativa.
    confidenceLow = Math.min(p10, p90, estimateValue);
    confidenceHigh = Math.max(p10, p90, estimateValue);
  } else {
    const bps = opts.intervalBps ?? DEFAULT_INTERVAL_BPS;
    const factor = bps / 10_000;
    confidenceLow = estimateValue * (1 - factor);
    confidenceHigh = estimateValue * (1 + factor);
  }

  return {
    estimate: estimateValue,
    confidenceLow,
    confidenceHigh,
    modelVersion: metadata.modelVersion,
    featuresUsed,
  };
}
