import { z } from 'zod';

/** Portal de origem do anúncio. */
export const ListingSourceSchema = z.enum(['zap', 'vivareal', 'olx']);
export type ListingSource = z.infer<typeof ListingSourceSchema>;

/** Tipo de imóvel. */
export const PropertyTypeSchema = z.enum(['apartment', 'house', 'commercial', 'land']);
export type PropertyType = z.infer<typeof PropertyTypeSchema>;

/** Operação do anúncio. */
export const OperationSchema = z.enum(['sale', 'rent']);
export type Operation = z.infer<typeof OperationSchema>;

/** CEP brasileiro em formato `NNNNN-NNN` ou `NNNNNNNN`. */
export const CepSchema = z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido');

/** UF brasileira (2 letras maiúsculas). */
export const UfSchema = z.string().length(2).regex(/^[A-Z]{2}$/, 'UF deve ter 2 letras maiúsculas');

/** Endereço normalizado usado em dedupe e features do modelo. */
export const NormalizedAddressSchema = z.object({
  street: z.string().min(1),
  number: z.string().min(1).optional(),
  neighborhood: z.string().min(1),
  city: z.string().min(1),
  state: UfSchema,
  cep: CepSchema,
});
export type NormalizedAddress = z.infer<typeof NormalizedAddressSchema>;

/**
 * RawListing — saída crua de um scraper, antes da normalização.
 * Campos opcionais/nulos refletem parsing parcial (ex: anúncio sem preço).
 */
export const RawListingSchema = z.object({
  source: ListingSourceSchema,
  sourceListingId: z.string().min(1),
  url: z.string().url(),
  title: z.string().optional(),
  description: z.string().optional(),
  price: z.number().nullable(),
  operation: OperationSchema,
  addressRaw: z.string().optional(),
  area: z.number().positive().nullable(),
  bedrooms: z.number().int().nonnegative().nullable(),
  bathrooms: z.number().int().nonnegative().nullable(),
  parking: z.number().int().nonnegative().nullable(),
  propertyType: PropertyTypeSchema.nullable(),
  scrapedAt: z.date(),
  partial: z.boolean().default(false),
});
export type RawListing = z.infer<typeof RawListingSchema>;

/**
 * NormalizedListing — RawListing após parsing/validação. Preço e área obrigatórios.
 * Essa é a forma que entra no banco e alimenta o modelo.
 */
export const NormalizedListingSchema = RawListingSchema.extend({
  price: z.number().positive(),
  area: z.number().positive(),
  addressNormalized: NormalizedAddressSchema,
  propertyType: PropertyTypeSchema,
});
export type NormalizedListing = z.infer<typeof NormalizedListingSchema>;
