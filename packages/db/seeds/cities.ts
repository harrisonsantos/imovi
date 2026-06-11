/**
 * Seed da tabela `cities` — cidades suportadas pelo Imovi AVM.
 *
 * Define as cidades ativas para a expansão multi-cidade, com centroide e
 * strings de location por portal (Zap, VivaReal, OLX) usadas pelos crawlers.
 *
 * Idempotente: usa ON CONFLICT (slug) DO UPDATE para re-rodar sem lixo.
 *
 * Execução: `pnpm -F @imovi/db seed:cities`
 * Requer env DATABASE_URL.
 */
import { sql } from 'drizzle-orm';
import { createDbClient } from '../src/client.js';
import { cities } from '../src/schema.js';

interface SeedCity {
  name: string;
  state: string;
  slug: string;
  active: boolean;
  centroidLat: number;
  centroidLng: number;
  portalLocations: Record<string, string>;
}

const CITIES: readonly SeedCity[] = [
  {
    name: 'Curitiba',
    state: 'PR',
    slug: 'curitiba-pr',
    active: true,
    centroidLat: -25.4284,
    centroidLng: -49.2733,
    portalLocations: {
      zap: 'pr+curitiba',
      vivareal: 'parana/curitiba',
      olx: 'pr/cidade-curitiba',
    },
  },
  {
    name: 'Porto Alegre',
    state: 'RS',
    slug: 'porto-alegre-rs',
    active: true,
    centroidLat: -30.0346,
    centroidLng: -51.2177,
    portalLocations: {
      zap: 'rs+porto-alegre',
      vivareal: 'rio-grande-do-sul/porto-alegre',
      olx: 'rs/cidade-porto-alegre',
    },
  },
  {
    name: 'Florianópolis',
    state: 'SC',
    slug: 'florianopolis-sc',
    active: true,
    centroidLat: -27.5954,
    centroidLng: -48.548,
    portalLocations: {
      zap: 'sc+florianopolis',
      vivareal: 'santa-catarina/florianopolis',
      olx: 'sc/cidade-florianopolis',
    },
  },
  {
    name: 'Belo Horizonte',
    state: 'MG',
    slug: 'belo-horizonte-mg',
    active: true,
    centroidLat: -19.9167,
    centroidLng: -43.9345,
    portalLocations: {
      zap: 'mg+belo-horizonte',
      vivareal: 'minas-gerais/belo-horizonte',
      olx: 'mg/cidade-belo-horizonte',
    },
  },
] as const;

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL não definido no ambiente.');
  }
  const db = createDbClient({ connectionString });

  // Upsert idempotente — re-rodar atualiza os dados sem duplicar.
  await db
    .insert(cities)
    .values(CITIES.map((c) => ({ ...c })))
    .onConflictDoUpdate({
      target: cities.slug,
      set: {
        name: sql`excluded.name`,
        state: sql`excluded.state`,
        active: sql`excluded.active`,
        centroidLat: sql`excluded.centroid_lat`,
        centroidLng: sql`excluded.centroid_lng`,
        portalLocations: sql`excluded.portal_locations`,
      },
    });

  // eslint-disable-next-line no-console
  console.log(`[seed:cities] ${CITIES.length} cidades sincronizadas.`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[seed:cities] falhou:', err);
  process.exit(1);
});
