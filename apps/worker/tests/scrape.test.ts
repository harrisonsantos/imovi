import { describe, it, expect } from 'vitest';
import { DEFAULT_CITY_JOBS } from '../src/commands/scrape.js';

describe('DEFAULT_CITY_JOBS', () => {
  it('usa pr/curitiba como location default da OLX para Curitiba', () => {
    const curitiba = DEFAULT_CITY_JOBS.find((j) => j.name === 'Curitiba');
    expect(curitiba).toBeDefined();
    expect(curitiba?.locations.olx).toBe('pr/curitiba');
  });
});
