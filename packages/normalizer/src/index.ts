export { normalize } from './normalize.js';
export { dedupe, type DedupeResult, type DedupeCluster } from './dedupe.js';
export { parsePrice } from './parsers/price.js';
export { parseArea } from './parsers/area.js';
export { parseAddress } from './parsers/address.js';
export {
  extractNeighborhood,
  matchNeighborhood,
  type NeighborhoodCandidate,
} from './neighborhood-matcher.js';
