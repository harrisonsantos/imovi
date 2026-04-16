import { describe, it, expect, vi } from 'vitest';
import { loadModel } from '../src/load.js';

// Sessão mock — apenas precisa ser um objeto; os tests de load só validam metadata.
const fakeSession = { run: vi.fn() } as unknown as import('onnxruntime-node').InferenceSession;
const sessionFactory = async (_bytes: Uint8Array) => fakeSession;

const validMetadata = JSON.stringify({
  modelVersion: '1.0.0',
  featureOrder: ['area_m2', 'bedrooms'],
  imputationMedians: { area_m2: 70, bedrooms: 2 },
  categories: ['apartment', 'house', 'commercial', 'land'],
});

describe('loadModel', () => {
  it('rejeita metadata sem modelVersion', async () => {
    const bad = JSON.stringify({
      featureOrder: ['area_m2'],
      imputationMedians: {},
      categories: [],
    });
    await expect(
      loadModel(new Uint8Array([1, 2, 3]), bad, { sessionFactory }),
    ).rejects.toThrow();
  });

  it('aceita metadata válida e retorna artifact', async () => {
    const artifact = await loadModel(new Uint8Array([1, 2, 3]), validMetadata, {
      sessionFactory,
    });
    expect(artifact.metadata.modelVersion).toBe('1.0.0');
    expect(artifact.session).toBe(fakeSession);
  });
});
