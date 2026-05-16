import { describe, it, expect, vi } from 'vitest';
import { estimate } from '../src/infer.js';
import type { EstimateInput, ModelArtifact, ModelMetadata } from '../src/types.js';

const metadata: ModelMetadata = {
  modelVersion: 'v-test-42',
  featureOrder: [
    'area_m2',
    'bedrooms',
    'bathrooms',
    'parking',
    'property_type_apartment',
    'property_type_house',
    'property_type_commercial',
    'property_type_land',
  ],
  imputationMedians: { area_m2: 70, bedrooms: 2, bathrooms: 1, parking: 1 },
  categories: ['apartment', 'house', 'commercial', 'land'],
};

function makeArtifact(outputValue: number): ModelArtifact {
  // Mock da InferenceSession — retorna { output: { data: Float32Array([outputValue]) } }
  const session = {
    run: vi.fn(async () => ({
      output: { data: new Float32Array([outputValue]) },
    })),
    inputNames: ['features'],
    outputNames: ['output'],
  } as unknown as import('onnxruntime-node').InferenceSession; // eslint-disable-line @typescript-eslint/consistent-type-imports
  return { session, metadata };
}

const input: EstimateInput = {
  area: 80,
  bedrooms: 2,
  bathrooms: 1,
  parking: 1,
  propertyType: 'apartment',
};

describe('estimate', () => {
  it('retorna estimate=500000 quando session mock devolve [500000]', async () => {
    const artifact = makeArtifact(500000);
    const out = await estimate(artifact, input);
    expect(out.estimate).toBe(500000);
  });

  it('intervalBps=2000 produz confidence low/high ±20%', async () => {
    const artifact = makeArtifact(1000);
    const out = await estimate(artifact, input, { intervalBps: 2000 });
    expect(out.confidenceLow).toBeCloseTo(800, 6);
    expect(out.confidenceHigh).toBeCloseTo(1200, 6);
  });

  it('default interval é ±15%', async () => {
    const artifact = makeArtifact(1000);
    const out = await estimate(artifact, input);
    expect(out.confidenceLow).toBeCloseTo(850, 6);
    expect(out.confidenceHigh).toBeCloseTo(1150, 6);
  });

  it('propaga modelVersion e featuresUsed', async () => {
    const artifact = makeArtifact(100000);
    const out = await estimate(artifact, input);
    expect(out.modelVersion).toBe('v-test-42');
    expect(out.featuresUsed.area_m2).toBe(80);
    expect(out.featuresUsed.property_type_apartment).toBe(1);
  });
});
