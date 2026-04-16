import { computeFingerprint, type NormalizedListing } from '@imovi/shared';

export interface DedupeCluster {
  /** Fingerprint canônico (o menor hash entre os candidatos do cluster). */
  fingerprint: string;
  /** Todas as listagens agrupadas. */
  listings: NormalizedListing[];
  /** Listagem escolhida como "canônica" do cluster (mais campos preenchidos). */
  representative: NormalizedListing;
}

export interface DedupeResult {
  clusters: DedupeCluster[];
}

/**
 * Conta campos "informativos" não-nulos/não-vazios em um NormalizedListing.
 * Quanto maior, mais completo o anúncio.
 */
function countPopulatedFields(listing: NormalizedListing): number {
  let count = 0;
  const fieldsToCheck: Array<keyof NormalizedListing> = [
    'title',
    'description',
    'bedrooms',
    'bathrooms',
    'parking',
    'addressRaw',
  ];
  for (const key of fieldsToCheck) {
    const value = listing[key];
    if (value !== null && value !== undefined && value !== '') {
      count += 1;
    }
  }
  if (listing.addressNormalized.number) count += 1;
  return count;
}

/**
 * Gera fingerprints candidatos para uma listagem, variando área em ±1m².
 *
 * `computeFingerprint` usa `Math.round(area)` na chave, o que tolera variações
 * subpixel (62.0 ↔ 62.4) mas não 62 ↔ 63. Anúncios do mesmo imóvel em portais
 * diferentes costumam divergir em 1–2m² (arredondamento do anunciante).
 * Emitimos aqui 3 fingerprints candidatos (area-1, area, area+1) e usamos
 * union-find para fundir clusters conectados.
 */
function candidateFingerprints(listing: NormalizedListing): string[] {
  return [
    computeFingerprint({ ...listing, area: listing.area - 1 }),
    computeFingerprint(listing),
    computeFingerprint({ ...listing, area: listing.area + 1 }),
  ];
}

/** Union-find simples com path compression. */
class DisjointSet {
  private parent: number[] = [];

  makeSet(): number {
    const id = this.parent.length;
    this.parent.push(id);
    return id;
  }

  find(x: number): number {
    const px = this.parent[x];
    if (px === undefined) throw new Error(`DisjointSet: índice ${x} não existe`);
    if (px === x) return x;
    const root = this.find(px);
    this.parent[x] = root;
    return root;
  }

  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
}

/**
 * Agrupa listagens do mesmo imóvel físico cross-portal, tolerando variações
 * de ±1m² na área reportada.
 *
 * O "representante" do cluster é a listagem com mais campos populados —
 * em empate, a primeira processada (ordem estável).
 */
export function dedupe(listings: NormalizedListing[]): DedupeResult {
  const ds = new DisjointSet();
  const ids = listings.map(() => ds.makeSet());

  // Mapa fingerprint → primeiro índice de listing visto com aquele fp.
  const fpToIndex = new Map<string, number>();

  for (let i = 0; i < listings.length; i += 1) {
    const listing = listings[i];
    const idA = ids[i];
    if (listing === undefined || idA === undefined) continue;
    const fps = candidateFingerprints(listing);
    for (const fp of fps) {
      const prior = fpToIndex.get(fp);
      if (prior !== undefined) {
        const idB = ids[prior];
        if (idB !== undefined) ds.union(idB, idA);
      } else {
        fpToIndex.set(fp, i);
      }
    }
  }

  // Agrupa por raiz do union-find.
  const buckets = new Map<number, number[]>();
  for (let i = 0; i < listings.length; i += 1) {
    const idA = ids[i];
    if (idA === undefined) continue;
    const root = ds.find(idA);
    const existing = buckets.get(root);
    if (existing) existing.push(i);
    else buckets.set(root, [i]);
  }

  const clusters: DedupeCluster[] = [];
  for (const indices of buckets.values()) {
    const clusterListings: NormalizedListing[] = [];
    for (const i of indices) {
      const l = listings[i];
      if (l !== undefined) clusterListings.push(l);
    }
    const first = clusterListings[0];
    if (first === undefined) continue;
    let representative: NormalizedListing = first;
    let bestScore = countPopulatedFields(representative);
    for (let i = 1; i < clusterListings.length; i += 1) {
      const candidate = clusterListings[i];
      if (candidate === undefined) continue;
      const score = countPopulatedFields(candidate);
      if (score > bestScore) {
        bestScore = score;
        representative = candidate;
      }
    }
    const fingerprint = computeFingerprint(representative);
    clusters.push({ fingerprint, listings: clusterListings, representative });
  }

  return { clusters };
}
