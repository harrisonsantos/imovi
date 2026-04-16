import { z } from 'zod';

/** Origem do dado de IPTU. */
export const IptuSourceSchema = z.enum([
  'infosimples',
  'geosampa',
  'pmsp-scrape',
  'manual',
]);
export type IptuSource = z.infer<typeof IptuSourceSchema>;

/**
 * Registro de IPTU enriquecido a partir de um endereço.
 * `assessedValue` = valor venal do imóvel (base de cálculo).
 * `iptuAmount` = valor do IPTU anual devido.
 * `rawPayload` preserva a resposta bruta do adapter para auditoria.
 */
export const IptuRecordSchema = z.object({
  propertyId: z.string().optional(),
  source: IptuSourceSchema,
  taxYear: z.number().int(),
  assessedValue: z.number().positive().nullable(),
  iptuAmount: z.number().positive().nullable(),
  cadastralNumber: z.string().optional(),
  rawPayload: z.unknown(),
  fetchedAt: z.date(),
});
export type IptuRecord = z.infer<typeof IptuRecordSchema>;
