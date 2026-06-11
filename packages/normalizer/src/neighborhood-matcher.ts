/**
 * Matcher de bairro: liga o bairro extraído do addressRaw a um registro da
 * tabela `neighborhoods` (passada como lista de candidatos — este módulo é
 * puro, sem acesso a DB).
 *
 * Usado pelo pipeline de scraping para popular properties.neighborhood_id,
 * pré-requisito das features de localização do modelo (median_price_m2 etc.).
 */

export interface NeighborhoodCandidate {
  id: string;
  name: string;
}

/** Folding de acentos + lowercase para comparação estável. */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Extrai o nome do bairro de um addressRaw, dado o nome da cidade.
 * Suporta os formatos dos portais:
 *   "Rua X, 456 - Batel, Curitiba/PR"  (rua + bairro + cidade)
 *   "Ahú - Curitiba/PR"                (bairro no início, separador hífen)
 *   "Santa Felicidade, Curitiba/PR"    (bairro no início, separador vírgula)
 */
export function extractNeighborhood(addressRaw: string, city: string): string | undefined {
  if (!addressRaw) return undefined;
  const cityRe = city.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Compara contra o endereço com acentos folded para casar "São Paulo"/"Sao Paulo"
  const foldedAddress = addressRaw.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const re = new RegExp(`(?:^|[-,])\\s*([^,\\-\\n/]{3,40}?)\\s*[-,]\\s*${cityRe}`, 'i');
  const m = foldedAddress.match(re);
  if (!m?.[1]) return undefined;
  // Recupera o trecho original (com acentos) pela posição do match
  const start = foldedAddress.indexOf(m[1]);
  if (start < 0) return m[1].trim();
  return addressRaw.slice(start, start + m[1].length).trim();
}

/**
 * Retorna o id do bairro candidato que casa com o bairro extraído do
 * addressRaw, ou undefined se não houver match.
 */
export function matchNeighborhood(
  addressRaw: string,
  city: string,
  candidates: readonly NeighborhoodCandidate[],
): string | undefined {
  const extracted = extractNeighborhood(addressRaw, city);
  if (!extracted) return undefined;
  const key = fold(extracted);
  return candidates.find((c) => fold(c.name) === key)?.id;
}
