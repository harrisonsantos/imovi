import type { NormalizedAddress } from '@imovi/shared';
import type { IptuRecord } from '../types.js';

/**
 * Adapter gratuito usando dados públicos do GeoSampa (Prefeitura de SP).
 *
 * TODO (implementação real):
 * 1. Baixar o shapefile "Iptu_Valor_Venal" do GeoSampa
 *    (https://geosampa.prefeitura.sp.gov.br/), atualizado anualmente.
 * 2. Indexar por setor/quadra/lote (SQL) ou por setor censitário.
 * 3. Dado um `NormalizedAddress`, geocodar para lote e retornar valor venal.
 * 4. Para cálculo de IPTU a partir do valor venal, aplicar alíquotas da PMSP.
 *
 * Por enquanto, lança erro — usar InfoSimples no fluxo principal.
 */
export class GeoSampaAdapter {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getIptu(
    _address: NormalizedAddress,
    _taxYear: number,
  ): Promise<IptuRecord | null> {
    throw new Error(
      'GeoSampa adapter não implementado — usar InfoSimples por enquanto',
    );
  }
}
