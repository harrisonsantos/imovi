/**
 * Schema Drizzle espelhando as migrations SQL.
 *
 * IMPORTANTE — dualidade Neon vs pglite:
 *   Em produção (Neon), `properties.geo` e `neighborhoods.boundary` são
 *   tipos PostGIS (`geography(Point, 4326)` / `geography(MultiPolygon, 4326)`).
 *   Em testes (pglite) os mesmos campos existem como `jsonb`.
 *   Como o Drizzle não tem um tipo PostGIS nativo e queremos um schema único
 *   para ambos, declaramos essas colunas como `jsonb` aqui. Escrever/ler
 *   pontos PostGIS em produção deve ser feito com SQL cru (ST_MakePoint etc.)
 *   bypassando o tipo declarado.
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  char,
  doublePrecision,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations, users } from './schema-auth.js';

export const cities = pgTable(
  'cities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    state: char('state', { length: 2 }).notNull(),
    slug: text('slug').notNull().unique(),
    active: boolean('active').notNull().default(false),
    centroidLat: doublePrecision('centroid_lat'),
    centroidLng: doublePrecision('centroid_lng'),
    /** Strings de location por portal: {"zap": "pr+curitiba", ...} */
    portalLocations: jsonb('portal_locations').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    nameStateUx: uniqueIndex('cities_name_state_ux2').on(t.name, t.state),
    activeIdx: index('cities_active_idx2').on(t.active),
  }),
);

export const neighborhoods = pgTable(
  'neighborhoods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    city: text('city').notNull(),
    state: char('state', { length: 2 }).notNull(),
    name: text('name').notNull(),
    boundary: jsonb('boundary'),
    medianPriceM2: numeric('median_price_m2', { precision: 10, scale: 2 }),
    priceSource: text('price_source').notNull().default('seed_reference'),
    listingCount: integer('listing_count').default(0),
    lastAggregatedAt: timestamp('last_aggregated_at', { withTimezone: true }),
  },
  (t) => ({
    cityStateNameUx: uniqueIndex('neighborhoods_city_state_name_ux').on(t.city, t.state, t.name),
  }),
);

export const properties = pgTable(
  'properties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fingerprint: text('fingerprint').notNull().unique(),
    addressRaw: text('address_raw'),
    street: text('street'),
    number: text('number'),
    neighborhoodId: uuid('neighborhood_id').references(() => neighborhoods.id),
    city: text('city'),
    state: char('state', { length: 2 }),
    cep: char('cep', { length: 9 }),
    geo: jsonb('geo'),
    propertyType: text('property_type'),
    areaM2: numeric('area_m2', { precision: 8, scale: 2 }),
    bedrooms: integer('bedrooms'),
    bathrooms: integer('bathrooms'),
    parking: integer('parking'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  },
  (t) => ({
    cityStateIdx: index('properties_city_state_idx').on(t.city, t.state),
  }),
);

export const listings = pgTable(
  'listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').references(() => properties.id),
    source: text('source').notNull(),
    sourceListingId: text('source_listing_id').notNull(),
    url: text('url'),
    title: text('title'),
    description: text('description'),
    price: numeric('price', { precision: 14, scale: 2 }),
    operation: text('operation'),
    rawHtmlRef: text('raw_html_ref'),
    scrapedAt: timestamp('scraped_at', { withTimezone: true }).notNull(),
    delistedAt: timestamp('delisted_at', { withTimezone: true }),
  },
  (t) => ({
    sourceListingUx: uniqueIndex('listings_source_source_listing_id_ux').on(
      t.source,
      t.sourceListingId,
    ),
    propertyScrapedIdx: index('listings_property_scraped_idx').on(t.propertyId, t.scrapedAt),
  }),
);

export const listingSnapshots = pgTable(
  'listing_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id').references(() => properties.id),
    operation: text('operation'),
    price: numeric('price', { precision: 14, scale: 2 }),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    listingIdx: index('listing_snapshots_listing_idx').on(t.listingId, t.capturedAt),
    capturedUx: uniqueIndex('listing_snapshots_listing_captured_ux').on(t.listingId, t.capturedAt),
  }),
);

export const iptuRecords = pgTable(
  'iptu_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'cascade' }),
    source: text('source'),
    taxYear: integer('tax_year'),
    assessedValue: numeric('assessed_value', { precision: 14, scale: 2 }),
    iptuAmount: numeric('iptu_amount', { precision: 12, scale: 2 }),
    cadastralNumber: text('cadastral_number'),
    rawPayload: jsonb('raw_payload'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    propertyYearSourceUx: uniqueIndex('iptu_records_property_year_source_ux').on(
      t.propertyId,
      t.taxYear,
      t.source,
    ),
    propertyIdx: index('iptu_records_property_idx').on(t.propertyId),
  }),
);

export const priceEstimates = pgTable(
  'price_estimates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').references(() => properties.id),
    inputPayload: jsonb('input_payload').notNull(),
    estimate: numeric('estimate', { precision: 14, scale: 2 }),
    confidenceLow: numeric('confidence_low', { precision: 14, scale: 2 }),
    confidenceHigh: numeric('confidence_high', { precision: 14, scale: 2 }),
    modelVersion: text('model_version').notNull(),
    method: text('method').notNull().default('heuristic'),
    resultMetadata: jsonb('result_metadata'),
    featuresUsed: jsonb('features_used'),
    comparablesIds: uuid('comparables_ids').array(),
    requestedBy: uuid('requested_by'),
    ownerUserId: text('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    propertyIdx: index('price_estimates_property_idx').on(t.propertyId),
    modelIdx: index('price_estimates_model_idx').on(t.modelVersion),
    ownerCreatedIdx: index('price_estimates_owner_created_idx').on(
      t.ownerUserId,
      t.createdAt.desc(),
    ),
  }),
);

export const modelVersions = pgTable(
  'model_versions',
  {
    version: text('version').primaryKey(),
    trainedAt: timestamp('trained_at', { withTimezone: true }),
    trainingRows: integer('training_rows'),
    metrics: jsonb('metrics'),
    artifactUrl: text('artifact_url'),
    active: boolean('active').notNull().default(false),
    notes: text('notes'),
  },
  (t) => ({
    activeIdx: index('model_versions_active_idx').on(t.active),
  }),
);

export const scrapeErrors = pgTable(
  'scrape_errors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: text('source'),
    url: text('url'),
    error: text('error'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sourceIdx: index('scrape_errors_source_idx').on(t.source, t.occurredAt),
  }),
);

export const iptuFetchErrors = pgTable(
  'iptu_fetch_errors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id'),
    adapter: text('adapter'),
    error: text('error'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    adapterIdx: index('iptu_fetch_errors_adapter_idx').on(t.adapter, t.occurredAt),
  }),
);

export const optOutRequests = pgTable(
  'opt_out_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email'),
    identifier: text('identifier'),
    reason: text('reason'),
    status: text('status').notNull().default('pending'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index('opt_out_requests_status_idx').on(t.status),
  }),
);

export const waitlistContacts = pgTable('waitlist_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  source: text('source').notNull(),
  consentVersion: text('consent_version').notNull(),
  consentedAt: timestamp('consented_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Keys are SHA-256(namespace + trusted IP); raw IPs are never stored. */
export const apiRateLimits = pgTable('api_rate_limits', {
  key: text('key').primaryKey(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
  count: integer('count').notNull().default(1),
});

export const usageCounters = pgTable(
  'usage_counters',
  {
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    metric: text('metric').notNull(),
    periodStart: timestamp('period_start', { withTimezone: true })
      .notNull()
      .default(sql`(date_trunc('month', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc')`),
    count: integer('count').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.orgId, t.metric, t.periodStart] }) }),
);

export type City = typeof cities.$inferSelect;
export type NewCity = typeof cities.$inferInsert;
export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type IptuRecord = typeof iptuRecords.$inferSelect;
export type NewIptuRecord = typeof iptuRecords.$inferInsert;
export type PriceEstimate = typeof priceEstimates.$inferSelect;
export type NewPriceEstimate = typeof priceEstimates.$inferInsert;
export type ModelVersion = typeof modelVersions.$inferSelect;
export type NewModelVersion = typeof modelVersions.$inferInsert;
export type ScrapeError = typeof scrapeErrors.$inferSelect;
export type NewScrapeError = typeof scrapeErrors.$inferInsert;
