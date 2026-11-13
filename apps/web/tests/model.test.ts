import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ active: vi.fn(), load: vi.fn(), session: vi.fn() }));
vi.mock('@imovi/db', () => ({
  createDbClient: vi.fn(() => ({})),
  modelVersionRepo: { getActive: mocks.active },
}));
vi.mock('@imovi/ml-infer/load-web', () => ({
  loadModelWeb: mocks.load,
  createWebSessionFactory: () => mocks.session,
}));
import { clearModelCache, getModelArtifact } from '../src/lib/model';

function bindings() {
  const get = vi.fn(async (_key: string) => ({
    arrayBuffer: async () => new ArrayBuffer(1),
    text: async () => '{}',
  }));
  return {
    env: { DATABASE_URL: 'postgres://test', MODEL_ARTIFACTS: { get } as unknown as R2Bucket },
    get,
  };
}
function version(version: string) {
  return { version, artifactUrl: `r2://models/versions/${version}/model.onnx` };
}
function artifact(version: string) {
  return { metadata: { modelVersion: version }, session: {} };
}

describe('immutable active model cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30'));
    vi.clearAllMocks();
    clearModelCache();
  });
  afterEach(() => vi.useRealTimers());
  it('loads all siblings from the active version and observes activation after five minutes', async () => {
    const { env, get } = bindings();
    mocks.active.mockResolvedValue(version('v1'));
    mocks.load.mockResolvedValue(artifact('v1'));
    expect((await getModelArtifact(env))?.metadata.modelVersion).toBe('v1');
    expect(get.mock.calls.map((call) => call[0])).toEqual([
      'versions/v1/model.onnx',
      'versions/v1/model.onnx.metadata.json',
      'versions/v1/model-p10.onnx',
      'versions/v1/model-p90.onnx',
    ]);
    mocks.active.mockResolvedValue(version('v2'));
    mocks.load.mockResolvedValue(artifact('v2'));
    expect((await getModelArtifact(env))?.metadata.modelVersion).toBe('v1');
    vi.advanceTimersByTime(300000);
    expect((await getModelArtifact(env))?.metadata.modelVersion).toBe('v2');
  });
  it('retries a transient failure after thirty seconds', async () => {
    const { env } = bindings();
    mocks.active
      .mockRejectedValueOnce(new Error('temporary db outage'))
      .mockResolvedValue(version('v1'));
    mocks.load.mockResolvedValue(artifact('v1'));
    expect(await getModelArtifact(env)).toBeNull();
    expect(await getModelArtifact(env)).toBeNull();
    expect(mocks.active).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(30000);
    expect((await getModelArtifact(env))?.metadata.modelVersion).toBe('v1');
  });
  it('rejects mutable paths or metadata from a different version', async () => {
    const { env, get } = bindings();
    mocks.active.mockResolvedValue({
      version: 'v1',
      artifactUrl: 'r2://models/current/model.onnx',
    });
    expect(await getModelArtifact(env)).toBeNull();
    expect(get).not.toHaveBeenCalled();
    clearModelCache();
    mocks.active.mockResolvedValue(version('v1'));
    mocks.load.mockResolvedValue(artifact('old-version'));
    expect(await getModelArtifact(env)).toBeNull();
  });
});
