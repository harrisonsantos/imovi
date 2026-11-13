import { z } from 'zod';
import type { NormalizedAddress } from '@imovi/shared';
import type { IptuRecord } from '../types.js';
import { InfoSimplesAdapter, type InfoSimplesConfig } from './infosimples.js';
import { cadastralNumber, fiscalNumber, fiscalYear } from './normalize-iptu.js';

const responseSchema = z.object({
  code: z.literal(200),
  data: z
    .array(
      z.object({
        inscricao_imobiliaria: cadastralNumber,
        exercicio: fiscalYear,
        area_construida: fiscalNumber,
        valor_venal: fiscalNumber,
        iptu_valor_total: fiscalNumber,
      }),
    )
    .length(1),
});

/** Contrato local: endpoint e cobertura precisam ser confirmados pelo fornecedor. */
export class CuritibaIptuAdapter extends InfoSimplesAdapter {
  constructor(config: InfoSimplesConfig & { endpoint: string }) {
    super(config);
  }

  override async getIptu(address: NormalizedAddress, taxYear: number): Promise<IptuRecord | null> {
    if (address.city.trim().toLowerCase() !== 'curitiba' || address.state !== 'PR') return null;
    return super.getIptu(address, taxYear);
  }

  protected override mapResponse(json: unknown, taxYear: number): Partial<IptuRecord> | null {
    const parsed = responseSchema.safeParse(json);
    const row = parsed.success ? parsed.data.data[0] : undefined;
    if (!row || row.exercicio !== taxYear) return null;
    const fiscal = {
      cadastralNumber: row.inscricao_imobiliaria,
      taxYear: row.exercicio,
      areaM2: row.area_construida,
      assessedValue: row.valor_venal,
      iptuAmount: row.iptu_valor_total,
    };
    return { source: 'infosimples', ...fiscal, rawPayload: fiscal, fetchedAt: new Date() };
  }
}
