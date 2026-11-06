import { describe, expect, it } from 'vitest';
import { isIndexablePriceReference } from '../src/lib/seo-data';

describe('verified public price coverage', () => {
  it('does not publish seed references or small samples as observed market medians', () => {
    expect(isIndexablePriceReference('seed_reference', 500)).toBe(false);
    expect(isIndexablePriceReference('insufficient_data', 19)).toBe(false);
    expect(isIndexablePriceReference('observed_listings', 19)).toBe(false);
    expect(isIndexablePriceReference('observed_listings', 20)).toBe(true);
  });
});
