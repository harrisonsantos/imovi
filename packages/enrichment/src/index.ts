export { fetchIptu, type FetchIptuOptions, type IptuAdapter } from './fetch-iptu.js';
export { InfoSimplesAdapter, type InfoSimplesConfig } from './adapters/infosimples.js';
export { GeoSampaAdapter } from './adapters/geosampa.js';
export { CuritibaIptuAdapter } from './adapters/curitiba.js';
export { IptuRecordSchema, type IptuRecord } from './types.js';
export { MemoryIptuCache, KvIptuCache, sanitizeIptuRecord, type IptuCache } from './cache.js';
export type { Logger } from './logger.js';
