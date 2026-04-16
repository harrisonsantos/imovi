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
export async function estimate(
  artifact: ModelArtifact,
  input: EstimateInput,
  opts: EstimateOptions = {},
): Promise<EstimateOutput> {
  const { session, metadata } = artifact;
  const [vec, featuresUsed] = buildFeatureVector(input, metadata);

  // Import dinâmico de onnxruntime-node — se indisponível (ex.: ambiente de testes
  // sem a dep nativa), caímos num tensor-like mínimo compatível com o shape esperado.
  // Em produção o módulo está sempre presente.
  let tensor: unknown;
  try {
    const ort = await import('onnxruntime-node');
    tensor = new ort.Tensor('float32', vec, [1, metadata.featureOrder.length]);
  } catch {
    tensor = { data: vec, dims: [1, metadata.featureOrder.length], type: 'float32' };
  }

  // Usa o primeiro input name da sessão; fallback para 'features' se indisponível.
  const inputName =
    (session.inputNames && session.inputNames[0]) !== undefined
      ? session.inputNames[0]!
      : 'features';

  // Cast porque aceitamos um tensor-like quando o runtime real não está disponível.
  const feeds = { [inputName]: tensor } as unknown as Parameters<typeof session.run>[0];
  const result = await session.run(feeds);

  // Pega o primeiro output (regressor escalar).
  const outputName =
    (session.outputNames && session.outputNames[0]) !== undefined
      ? session.outputNames[0]!
      : Object.keys(result)[0]!;
  const outTensor = result[outputName];
  if (!outTensor) {
    throw new Error(`Output '${outputName}' ausente no resultado da inferência`);
  }

  const data = outTensor.data as Float32Array | Float64Array | number[];
  const first = data[0];
  if (typeof first !== 'number') {
    throw new Error('Saída do modelo vazia ou não numérica');
  }
  const estimateValue = Number(first);

  const bps = opts.intervalBps ?? DEFAULT_INTERVAL_BPS;
  const factor = bps / 10_000;
  const confidenceLow = estimateValue * (1 - factor);
  const confidenceHigh = estimateValue * (1 + factor);

  return {
    estimate: estimateValue,
    confidenceLow,
    confidenceHigh,
    modelVersion: metadata.modelVersion,
    featuresUsed,
  };
}
