import type { NormalizedAddress } from '@imovi/shared';

/**
 * Mapa simples de abreviações → forma expandida canônica para logradouros.
 * Mantém-se conservador: só expande abreviações muito comuns.
 */
const STREET_ABBREV: Record<string, string> = {
  'r.': 'Rua',
  'r': 'Rua',
  'av.': 'Avenida',
  'av': 'Avenida',
  'al.': 'Alameda',
  'al': 'Alameda',
  'trav.': 'Travessa',
  'pç.': 'Praça',
  'pç': 'Praça',
  'pc.': 'Praça',
  'pc': 'Praça',
  'rod.': 'Rodovia',
  'rod': 'Rodovia',
};

/** Normaliza CEP para o formato NNNNN-NNN. */
function formatCep(cepDigits: string): string {
  return `${cepDigits.slice(0, 5)}-${cepDigits.slice(5, 8)}`;
}

/** Extrai CEP (com ou sem traço) da string. Retorna só os 8 dígitos. */
function extractCep(raw: string): string | null {
  const match = raw.match(/(\d{5})-?(\d{3})/);
  if (!match || match[1] === undefined || match[2] === undefined) return null;
  return `${match[1]}${match[2]}`;
}

/** Expande abreviação inicial do logradouro ("R." → "Rua"). */
function expandStreetPrefix(street: string): string {
  const trimmed = street.trim();
  const tokens = trimmed.split(/\s+/);
  const first = tokens[0];
  if (first === undefined) return trimmed;
  const expanded = STREET_ABBREV[first.toLowerCase()];
  if (expanded) {
    return [expanded, ...tokens.slice(1)].join(' ');
  }
  return trimmed;
}

/** Remove número do final da string de rua se presente. */
function splitStreetAndNumber(
  streetPart: string,
): { street: string; number?: string } {
  // "Rua Ibituruna 123" ou "Rua Ibituruna, 123"
  const match = streetPart.match(/^(.*?)[,\s]+(\d+[A-Za-z]?)\s*$/);
  if (match && match[1] !== undefined && match[2] !== undefined) {
    return { street: match[1].trim(), number: match[2].trim() };
  }
  return { street: streetPart.trim() };
}

/**
 * Heurística para UF: 2 letras maiúsculas no token. Aceita "SP", "São Paulo/SP".
 */
function extractState(raw: string): string | null {
  // "São Paulo/SP" ou " SP " ou "SP " no final.
  const slashMatch = raw.match(/\/([A-Z]{2})\b/);
  if (slashMatch && slashMatch[1] !== undefined) return slashMatch[1];
  const standalone = raw.match(/\b([A-Z]{2})\b/);
  if (standalone && standalone[1] !== undefined) return standalone[1];
  return null;
}

/**
 * Parser tolerante de endereço BR. Suporta dois formatos principais:
 *
 *   A) Formal com vírgulas:
 *      "Rua Ibituruna, 123 - Moema, São Paulo/SP - 04037-050"
 *
 *   B) Flat sem pontuação:
 *      "R. Ibituruna 123 Moema SP 04037050"
 *
 * TODO: lookup de CEP via ViaCEP/serviço externo para preencher campos faltantes.
 * Por ora, o CEP é obrigatório — vem no input ou no fallback.
 */
export function parseAddress(
  raw: string,
  fallback?: Partial<NormalizedAddress>,
): NormalizedAddress | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;

  const input = raw.trim();

  // 1. Extrai CEP (pode estar em qualquer posição).
  const cepDigits = extractCep(input) ?? (fallback?.cep ? fallback.cep.replace(/-/g, '') : null);
  if (!cepDigits || cepDigits.length !== 8) return null;
  const cep = formatCep(cepDigits);

  // 2. Extrai UF.
  const state = extractState(input) ?? fallback?.state ?? null;
  if (!state) return null;

  // Remove CEP da string para simplificar parsing do restante.
  const withoutCep = input.replace(/(\d{5})-?(\d{3})/, '').trim();

  let street: string | undefined;
  let number: string | undefined;
  let neighborhood: string | undefined;
  let city: string | undefined;

  // Formato A: separado por vírgulas/hífens.
  // Ex: "Rua Ibituruna, 123 - Moema, São Paulo/SP"
  if (withoutCep.includes(',') || withoutCep.includes(' - ')) {
    // Partes separadas por vírgula ou " - ".
    const parts = withoutCep
      .split(/,|\s-\s/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    // Caso "Rua X, 123 - Moema, São Paulo/SP":
    // parts[0] = "Rua X", parts[1] = "123", parts[2] = "Moema", parts[3] = "São Paulo/SP"
    // Caso "Rua X 123 - Moema, São Paulo/SP":
    // parts[0] = "Rua X 123", parts[1] = "Moema", parts[2] = "São Paulo/SP"
    const [p0, p1, p2, p3] = parts;
    if (parts.length >= 4 && p0 && p1 && p2 && p3 && /^\d+[A-Za-z]?$/.test(p1)) {
      street = p0;
      number = p1;
      neighborhood = p2;
      city = p3;
    } else if (parts.length >= 3 && p0 && p1 && p2) {
      const split = splitStreetAndNumber(p0);
      street = split.street;
      number = split.number;
      neighborhood = p1;
      city = p2;
    } else if (parts.length === 2 && p0 && p1) {
      const split = splitStreetAndNumber(p0);
      street = split.street;
      number = split.number;
      neighborhood = p1;
    }
  } else {
    // Formato B: flat.
    // Ex: "R. Ibituruna 123 Moema SP"
    // Estratégia: remove UF do final; depois separa via número;
    // tudo antes do número = rua (com abreviação a expandir);
    // tudo depois do número e antes da UF = bairro (+ cidade, se houver).
    let flat = withoutCep.replace(new RegExp(`\\b${state}\\b\\s*$`), '').trim();
    // Também remove padrão "Cidade/UF" final.
    flat = flat.replace(new RegExp(`/\\s*${state}\\s*$`), '').trim();

    const numMatch = flat.match(/^(.*?)\s+(\d+[A-Za-z]?)\s+(.*)$/);
    if (
      numMatch &&
      numMatch[1] !== undefined &&
      numMatch[2] !== undefined &&
      numMatch[3] !== undefined
    ) {
      street = numMatch[1].trim();
      number = numMatch[2].trim();
      const tail = numMatch[3].trim();
      const tailTokens = tail.split(/\s+/);
      const first = tailTokens[0];
      if (first !== undefined) {
        neighborhood = first;
        if (tailTokens.length >= 2) {
          city = tailTokens.slice(1).join(' ');
        }
      }
    } else {
      // Sem número extraível: tudo (menos UF) vira rua.
      street = flat;
    }
  }

  // Expande prefixo do logradouro se ainda estiver abreviado.
  if (street) {
    street = expandStreetPrefix(street);
  }

  // Remove sufixo "/UF" ou " UF" da cidade e pontuação residual.
  if (city) {
    // Remove pontuação nas bordas primeiro (ex: "São Paulo/SP -" → "São Paulo/SP").
    city = city.replace(/^[\s\-,]+|[\s\-,]+$/g, '').trim();
    city = city.replace(new RegExp(`\\s*/\\s*${state}\\s*$`), '').trim();
    city = city.replace(new RegExp(`\\s+${state}\\s*$`), '').trim();
    city = city.replace(/^[\s\-,]+|[\s\-,]+$/g, '').trim();
  }

  // Aplica fallback onde faltam campos.
  const finalStreet = street ?? fallback?.street;
  const finalNeighborhood = neighborhood ?? fallback?.neighborhood;
  // Quando cidade não vem explícita no endereço flat (ex: "R. X 123 Moema SP"),
  // o CEP já identifica a cidade univocamente. Enquanto o lookup externo não existe
  // (TODO: ViaCEP), usamos o bairro como placeholder de cidade para satisfazer o schema.
  const finalCity = city ?? fallback?.city ?? finalNeighborhood;
  const finalNumber = number ?? fallback?.number;

  if (!finalStreet || !finalNeighborhood || !finalCity) return null;

  const address: NormalizedAddress = {
    street: finalStreet,
    neighborhood: finalNeighborhood,
    city: finalCity,
    state,
    cep,
  };
  if (finalNumber) {
    address.number = finalNumber;
  }
  return address;
}
