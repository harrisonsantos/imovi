/** CEPs representativos (centróides de bairro) para Curitiba/PR. */
export const CURITIBA_CEP_BY_NEIGHBORHOOD: Record<string, string> = {
  // Bairros nobres / seed
  'batel': '80420-000',
  'champagnat': '80730-060',
  'jardim social': '80535-000',
  'bigorrilho': '80730-000',
  'hugo lange': '80540-000',
  'alto da xv': '80040-300',
  'cabral': '80035-000',
  'água verde': '80620-010',
  'agua verde': '80620-010',
  'são francisco': '80120-000',
  'sao francisco': '80120-000',
  'juvevê': '80030-340',
  'juveve': '80030-340',
  'mercês': '80810-000',
  'merces': '80810-000',
  'ahú': '80540-140',
  'ahu': '80540-140',
  'rebouças': '80220-000',
  'reboucas': '80220-000',
  'cristo rei': '80050-000',
  'boa vista': '82560-000',
  'santa felicidade': '82015-000',
  'centro': '80010-010',
  'portão': '81070-000',
  'portao': '81070-000',
  'boqueirão': '81650-000',
  'boqueirao': '81650-000',
  'pinheirinho': '81980-000',
  'cajuru': '82900-000',
  // Bairros comuns nos portais (Zap/OLX/VivaReal)
  'hauer': '82610-000',
  'uberaba': '82500-000',
  'santa cândida': '82640-000',
  'santa candida': '82640-000',
  'bairro alto': '82820-000',
  'lindóia': '81110-000',
  'lindoia': '81110-000',
  'campo comprido': '81200-000',
  'cidade industrial': '81170-000',
  'cic': '81170-000',
  'ecoville': '81200-000',
  'seminário': '80420-070',
  'seminario': '80420-070',
  'jardim botânico': '80215-000',
  'jardim botanico': '80215-000',
  'prado velho': '80215-000',
  'guabirotuba': '82010-000',
  'são braz': '82330-000',
  'sao braz': '82330-000',
  'bacacheri': '82510-000',
  'xaxim': '81730-000',
  'fazendinha': '81320-000',
  'sítio cercado': '81970-000',
  'sitio cercado': '81970-000',
  'capão da imbuia': '82810-000',
  'capao da imbuia': '82810-000',
  'barreirinha': '82750-000',
  'tingui': '82620-000',
  'santa quitéria': '80310-000',
  'santa quiteria': '80310-000',
  'Vila Izabel': '80320-000',
  'vila izabel': '80320-000',
  'tarumã': '82520-000',
  'taruma': '82520-000',
  'butiatuvinha': '82300-000',
  'campo de santana': '81990-000',
  'umbará': '81920-000',
  'umbara': '81920-000',
};

/** CEP genérico do centro de Curitiba, usado quando o bairro não está mapeado. */
const CURITIBA_CENTER_CEP = '80010-010';

/**
 * CEP do centro por cidade coberta — fallback genérico quando o endereço só
 * tem o nome da cidade. Expandir junto com o seed de `cities`.
 */
export const CITY_CENTER_CEP: Record<string, { cep: string; city: string; state: string }> = {
  'curitiba': { cep: CURITIBA_CENTER_CEP, city: 'Curitiba', state: 'PR' },
  'porto alegre': { cep: '90010-000', city: 'Porto Alegre', state: 'RS' },
  'florianopolis': { cep: '88010-000', city: 'Florianópolis', state: 'SC' },
  'belo horizonte': { cep: '30110-000', city: 'Belo Horizonte', state: 'MG' },
};

export interface AddressFallback {
  cep: string;
  city: string;
  state: string;
}

/**
 * Fallback genérico de endereço: detecta a cidade coberta mencionada no
 * addressRaw e retorna {cep, city, state} representativos. Para Curitiba,
 * tenta primeiro o CEP específico do bairro.
 */
export function resolveAddressFallback(addressRaw: string): AddressFallback | undefined {
  const folded = addressRaw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

  for (const [key, entry] of Object.entries(CITY_CENTER_CEP)) {
    if (!folded.includes(key)) continue;
    if (entry.city === 'Curitiba') {
      const cep = getCuritibaCepFallback(addressRaw);
      if (cep) return { cep, city: entry.city, state: entry.state };
    }
    return { cep: entry.cep, city: entry.city, state: entry.state };
  }
  return undefined;
}

/**
 * Tenta extrair o bairro do addressRaw e retorna um CEP de fallback para
 * Curitiba/PR. Retorna o CEP do centro quando o bairro não está mapeado.
 *
 * Suporta os formatos do Zap/VivaReal/OLX:
 *   "Batel - Curitiba/PR"            (bairro no início)
 *   "Rua X - Batel - Curitiba/PR"    (rua + bairro + cidade)
 *   "Rua X, Batel, Curitiba"         (separadores por vírgula)
 */
export function getCuritibaCepFallback(addressRaw: string): string | undefined {
  if (!/curitiba/i.test(addressRaw)) return undefined;

  // Extrai o token imediatamente antes de "Curitiba" (separado por [-,/])
  // (?:^|[-,]) cobre tanto início de string quanto separadores intermediários
  const match = addressRaw.match(/(?:^|[-,])\s*([^,\-\n/]{3,30}?)\s*[-,]\s*Curitiba/i);
  const neighborhood = match?.[1]?.trim().toLowerCase();

  if (!neighborhood) return CURITIBA_CENTER_CEP;

  // Tenta lookup direto, depois com acentos normalizados
  const deaccented = neighborhood
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

  return (
    CURITIBA_CEP_BY_NEIGHBORHOOD[neighborhood] ??
    CURITIBA_CEP_BY_NEIGHBORHOOD[deaccented] ??
    // Bairro extraído mas não mapeado → usa centro como proxy
    CURITIBA_CENTER_CEP
  );
}
