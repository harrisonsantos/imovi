import { describe, it, expect } from 'vitest';
import { buildFeatureVector } from '../src/features.js';
import type { EstimateInput, ModelMetadata } from '../src/types.js';

// Metadata canônica usada nos testes — espelha o contrato do treino.
const metadata: ModelMetadata = {
  modelVersion: 'test-1.0.0',
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
  imputationMedians: {
    area_m2: 75,
    bedrooms: 2,
    bathrooms: 1,
    parking: 1,
  },
  categories: ['apartment', 'house', 'commercial', 'land'],
};

describe('buildFeatureVector', () => {
  it('aplica imputação quando area é null', () => {
    const input: EstimateInput = {
      area: null,
      bedrooms: 3,
      bathrooms: 2,
      parking: 1,
      propertyType: 'apartment',
    };
    const [vec, used] = buildFeatureVector(input, metadata);
    expect(vec[0]).toBe(75); // mediana imputada
    expect(used.area_m2).toBe(75);
  });

  it("one-hot com property_type='house' gera [0,1,0,0]", () => {
    const input: EstimateInput = {
      area: 100,
      bedrooms: 3,
      bathrooms: 2,
      parking: 1,
      propertyType: 'house',
    };
    const [vec] = buildFeatureVector(input, metadata);
    // posições 4..7 são o one-hot
    expect(Array.from(vec.slice(4, 8))).toEqual([0, 1, 0, 0]);
  });

  it('respeita a ordem de featureOrder', () => {
    const input: EstimateInput = {
      area: 120,
      bedrooms: 4,
      bathrooms: 3,
      parking: 2,
      propertyType: 'commercial',
    };
    const [vec] = buildFeatureVector(input, metadata);
    expect(vec.length).toBe(metadata.featureOrder.length);
    expect(vec[0]).toBe(120);
    expect(vec[1]).toBe(4);
    expect(vec[2]).toBe(3);
    expect(vec[3]).toBe(2);
    expect(Array.from(vec.slice(4, 8))).toEqual([0, 0, 1, 0]);
  });

  it('featuresUsed é dict com nomes humanos', () => {
    const input: EstimateInput = {
      area: 90,
      bedrooms: 2,
      bathrooms: 1,
      parking: 0,
      propertyType: 'land',
    };
    const [, used] = buildFeatureVector(input, metadata);
    expect(used).toMatchObject({
      area_m2: 90,
      bedrooms: 2,
      bathrooms: 1,
      parking: 0,
      property_type_land: 1,
      property_type_apartment: 0,
    });
  });
});
