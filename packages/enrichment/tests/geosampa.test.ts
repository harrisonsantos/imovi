import { describe, it, expect } from 'vitest';
import type { NormalizedAddress } from '@imovi/shared';
import { GeoSampaAdapter } from '../src/adapters/geosampa.js';

describe('GeoSampaAdapter', () => {
  it('lança erro específico "não implementado" (documenta TODO)', async () => {
    const adapter = new GeoSampaAdapter();
    const address: NormalizedAddress = {
      street: 'Rua X',
      number: '1',
      neighborhood: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      cep: '01000-000',
    };
    await expect(adapter.getIptu(address, 2026)).rejects.toThrow(
      /não implementado/,
    );
  });
});
