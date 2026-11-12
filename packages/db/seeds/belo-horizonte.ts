/**
 * Seed de bairros de Belo Horizonte/MG com mediana de preço/m² (venda, apartamentos).
 *
 * Fonte dos números: dados públicos FIPEZAP / portais de anúncios 2025/2026.
 * Valores são aproximações iniciais — serão sobrescritos pelo agregador
 * assim que houver listings suficientes no banco.
 *
 * Idempotente: usa ON CONFLICT (city,state,name) DO UPDATE para re-rodar sem lixo.
 *
 * Execução: `pnpm -F @imovi/db seed:belo-horizonte`
 * Requer env DATABASE_URL.
 */
import { sql } from 'drizzle-orm';
import { createDbClient } from '../src/client.js';
import { neighborhoods } from '../src/schema.js';

interface SeedRow {
  name: string;
  medianPriceM2: number;
}

// R$/m² — apartamentos, venda, aproximações 2025/2026.
const BELO_HORIZONTE_NEIGHBORHOODS: readonly SeedRow[] = [
  { name: 'Lourdes', medianPriceM2: 13000 },
  { name: 'Santo Agostinho', medianPriceM2: 12000 },
  { name: 'Funcionários', medianPriceM2: 11500 },
  { name: 'Savassi', medianPriceM2: 11000 },
  { name: 'Belvedere', medianPriceM2: 11000 },
  { name: 'Sion', medianPriceM2: 10000 },
  { name: 'Anchieta', medianPriceM2: 9500 },
  { name: 'Serra', medianPriceM2: 9000 },
  { name: 'Cruzeiro', medianPriceM2: 9000 },
  { name: 'Cidade Jardim', medianPriceM2: 9000 },
  { name: 'São Pedro', medianPriceM2: 9000 },
  { name: 'Carmo', medianPriceM2: 9000 },
  { name: 'Gutierrez', medianPriceM2: 8500 },
  { name: 'Luxemburgo', medianPriceM2: 8500 },
  { name: 'Santo Antônio', medianPriceM2: 8500 },
  { name: 'Buritis', medianPriceM2: 7000 },
  { name: 'Castelo', medianPriceM2: 6800 },
  { name: 'Cidade Nova', medianPriceM2: 6500 },
  { name: 'Liberdade', medianPriceM2: 6500 },
  { name: 'Palmares', medianPriceM2: 6200 },
  { name: 'Jaraguá', medianPriceM2: 6200 },
  { name: 'Barro Preto', medianPriceM2: 6000 },
  { name: 'Floresta', medianPriceM2: 6000 },
  { name: 'União', medianPriceM2: 6000 },
  { name: 'Ouro Preto', medianPriceM2: 6000 },
  { name: 'Santa Efigênia', medianPriceM2: 5800 },
  { name: 'Sagrada Família', medianPriceM2: 5800 },
  { name: 'Padre Eustáquio', medianPriceM2: 5800 },
  { name: 'Centro', medianPriceM2: 5500 },
  { name: 'Caiçara', medianPriceM2: 5500 },
] as const;

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL não definido no ambiente.');
  }
  const db = createDbClient({ connectionString });

  const rows = BELO_HORIZONTE_NEIGHBORHOODS.map((n) => ({
    city: 'Belo Horizonte',
    state: 'MG',
    name: n.name,
    boundary: null,
    // numeric() no drizzle aceita string; convertemos com toFixed pra evitar lixo float.
    medianPriceM2: n.medianPriceM2.toFixed(2),
    priceSource: 'seed_reference',
    lastAggregatedAt: null,
  }));

  // Upsert idempotente — re-rodar atualiza apenas o preço.
  await db
    .insert(neighborhoods)
    .values(rows)
    .onConflictDoUpdate({
      target: [neighborhoods.city, neighborhoods.state, neighborhoods.name],
      set: {
        medianPriceM2: sql`excluded.median_price_m2`,
        lastAggregatedAt: sql`excluded.last_aggregated_at`,
        priceSource: 'seed_reference',
      },
      setWhere: sql`${neighborhoods.priceSource} <> 'observed_listings'`,
    });

  console.log(`[seed:belo-horizonte] ${rows.length} bairros sincronizados.`);
}

main().catch((err) => {
  console.error('[seed:belo-horizonte] falhou:', err);
  process.exit(1);
});
