import { describe, expect, it } from 'vitest';
import { estimateHeuristic, type HeuristicInput } from '../src/heuristic.js';

function baseInput(overrides: Partial<HeuristicInput> = {}): HeuristicInput {
  return {
    neighborhoodPriceM2: 11000,
    areaM2: 60,
    bedrooms: 2,
    bathrooms: 1,
    parking: 0,
    propertyType: 'apartment',
    ...overrides,
  };
}

describe('estimateHeuristic', () => {
  it('baseline apartamento 60m² em Batel = 660k ± 30%', () => {
    const out = estimateHeuristic(baseInput());
    expect(out.estimate).toBeCloseTo(660_000, 2);
    expect(out.confidenceLow).toBeCloseTo(462_000, 2);
    expect(out.confidenceHigh).toBeCloseTo(858_000, 2);
    expect(out.modelVersion).toBe('heuristic-v0');
  });

  it('house 100m² no Centro aplica multiplier 1.15', () => {
    const out = estimateHeuristic(
      baseInput({ neighborhoodPriceM2: 6500, areaM2: 100, propertyType: 'house' }),
    );
    // base = 6500 * 100 = 650000; * 1.15 = 747500 (demais multipliers neutros)
    expect(out.estimate).toBeCloseTo(747_500, 2);
    expect(out.featuresUsed.typeMultiplier).toBe(1.15);
  });

  it('commercial aplica multiplier 0.90', () => {
    const out = estimateHeuristic(baseInput({ propertyType: 'commercial' }));
    expect(out.estimate).toBeCloseTo(660_000 * 0.9, 2);
  });

  it('land aplica multiplier 0.50', () => {
    const out = estimateHeuristic(baseInput({ propertyType: 'land' }));
    expect(out.estimate).toBeCloseTo(660_000 * 0.5, 2);
  });

  it('3 quartos aumenta 4% vs baseline 2 quartos', () => {
    const baseline = estimateHeuristic(baseInput({ bedrooms: 2 }));
    const withExtra = estimateHeuristic(baseInput({ bedrooms: 3 }));
    expect(withExtra.estimate / baseline.estimate).toBeCloseTo(1.04, 6);
  });

  it('1 quarto diminui 4% vs baseline 2 quartos', () => {
    const baseline = estimateHeuristic(baseInput({ bedrooms: 2 }));
    const withLess = estimateHeuristic(baseInput({ bedrooms: 1 }));
    expect(withLess.estimate / baseline.estimate).toBeCloseTo(0.96, 6);
  });

  it('2 banheiros aumenta 3% vs baseline 1 banheiro', () => {
    const baseline = estimateHeuristic(baseInput({ bathrooms: 1 }));
    const withExtra = estimateHeuristic(baseInput({ bathrooms: 2 }));
    expect(withExtra.estimate / baseline.estimate).toBeCloseTo(1.03, 6);
  });

  it('2 vagas aumenta 10% (cumulativo 5% por vaga)', () => {
    const baseline = estimateHeuristic(baseInput({ parking: 0 }));
    const withParking = estimateHeuristic(baseInput({ parking: 2 }));
    expect(withParking.estimate / baseline.estimate).toBeCloseTo(1.1, 6);
  });

  it('nulls usam defaults neutros (bedrooms=2, bathrooms=1, parking=0)', () => {
    const out = estimateHeuristic(
      baseInput({ bedrooms: null, bathrooms: null, parking: null }),
    );
    expect(out.featuresUsed.bedrooms).toBe(2);
    expect(out.featuresUsed.bathrooms).toBe(1);
    expect(out.featuresUsed.parking).toBe(0);
    // Mesmo estimate do baseline com todos os defaults.
    expect(out.estimate).toBeCloseTo(660_000, 2);
  });

  it('confidenceLow < estimate < confidenceHigh sempre', () => {
    const samples: HeuristicInput[] = [
      baseInput(),
      baseInput({ propertyType: 'land', areaM2: 500 }),
      baseInput({ bedrooms: 5, bathrooms: 4, parking: 3 }),
      baseInput({ neighborhoodPriceM2: 4200, propertyType: 'commercial' }),
    ];
    for (const s of samples) {
      const out = estimateHeuristic(s);
      expect(out.confidenceLow).toBeLessThan(out.estimate);
      expect(out.estimate).toBeLessThan(out.confidenceHigh);
    }
  });
});
