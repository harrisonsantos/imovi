import { z } from 'zod';

export const PublicEstimateSchema = z.object({
  id: z.string().uuid(),
  reference: z.string().uuid(),
  estimate: z.number().positive(),
  confidenceLow: z.number().nonnegative(),
  confidenceHigh: z.number().positive(),
  modelVersion: z.string(),
  featuresUsed: z.record(z.string(), z.number()),
  property: z.object({
    city: z.string(),
    state: z.string().length(2),
    neighborhood: z.string(),
    area: z.number().positive(),
    propertyType: z.enum(['apartment', 'house', 'commercial', 'land']),
    bedrooms: z.number().int().nonnegative().optional(),
    bathrooms: z.number().int().nonnegative().optional(),
    parking: z.number().int().nonnegative().optional(),
  }),
  neighborhood: z.object({ name: z.string(), medianPriceM2: z.number().positive() }),
  method: z.enum(['heuristic', 'model']),
  dataSource: z.object({
    kind: z.enum(['seed_reference', 'listing_aggregate', 'insufficient_data']),
    sampleCount: z.number().int().nonnegative(),
    updatedAt: z.string().datetime().nullable(),
  }),
  generatedAt: z.string().datetime(),
});

export type PublicEstimate = z.infer<typeof PublicEstimateSchema>;

/** Strict projection: never spread inputPayload, tokens, identity or audit fields. */
export function publicEstimateOf(row: {
  id: string;
  estimate: string | null;
  confidenceLow: string | null;
  confidenceHigh: string | null;
  modelVersion: string;
  featuresUsed: unknown;
  resultMetadata: unknown;
  inputPayload: unknown;
}): PublicEstimate | null {
  const metadata = row.resultMetadata as Record<string, unknown> | null;
  if (!metadata) return null;
  const parsed = PublicEstimateSchema.safeParse({
    id: row.id,
    reference: row.id,
    estimate: Number(row.estimate),
    confidenceLow: Number(row.confidenceLow),
    confidenceHigh: Number(row.confidenceHigh),
    modelVersion: row.modelVersion,
    featuresUsed: row.featuresUsed,
    property: row.inputPayload,
    neighborhood: metadata.neighborhood,
    method: metadata.method,
    dataSource: metadata.dataSource,
    generatedAt: metadata.generatedAt,
  });
  return parsed.success ? parsed.data : null;
}

export function sourceDescription(source: PublicEstimate['dataSource']): string {
  if (source.kind === 'seed_reference')
    return 'Referência inicial aproximada; não representa uma mediana observada de anúncios.';
  if (source.kind === 'insufficient_data')
    return `Dados insuficientes: ${source.sampleCount} imóveis distintos; mínimo de 20 para mediana observada.`;
  return `Mediana de anúncios de venda: ${source.sampleCount} imóveis distintos. Preços anunciados não são preços de transações.`;
}
