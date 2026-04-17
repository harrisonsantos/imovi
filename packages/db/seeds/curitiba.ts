/**
 * Seed de bairros de Curitiba/PR com mediana de preço/m² (venda, apartamentos).
 *
 * Fonte dos números: dados públicos FIPEZAP / Zap Imóveis Q4/2025.
 * Valores são aproximações iniciais — serão sobrescritos pelo agregador
 * assim que houver listings suficientes no banco.
 *
 * Idempotente: usa ON CONFLICT (city,state,name) DO UPDATE para re-rodar sem lixo.
 *
 * Execução: `pnpm -F @imovi/db seed:curitiba`
 * Requer env DATABASE_URL.
 */
import { sql } from 'drizzle-orm';
import { createDbClient } from '../src/client.js';
import { neighborhoods } from '../src/schema.js';

interface SeedRow {
  name: string;
  medianPriceM2: number;
}

// R$/m² — apartamentos, venda, Q4/2025.
const CURITIBA_NEIGHBORHOODS: readonly SeedRow[] = [
  { name: 'Batel', medianPriceM2: 11000 },
  { name: 'Champagnat', medianPriceM2: 10500 },
  { name: 'Jardim Social', medianPriceM2: 9800 },
  { name: 'Bigorrilho', medianPriceM2: 9500 },
  { name: 'Hugo Lange', medianPriceM2: 9500 },
  { name: 'Alto da XV', medianPriceM2: 9000 },
  { name: 'Cabral', medianPriceM2: 8800 },
  { name: 'Água Verde', medianPriceM2: 8500 },
  { name: 'São Francisco', medianPriceM2: 8500 },
  { name: 'Juvevê', medianPriceM2: 8200 },
  { name: 'Mercês', medianPriceM2: 8000 },
  { name: 'Ahú', medianPriceM2: 7800 },
  { name: 'Rebouças', medianPriceM2: 7500 },
  { name: 'Cristo Rei', medianPriceM2: 7200 },
  { name: 'Boa Vista', medianPriceM2: 7000 },
  { name: 'Santa Felicidade', medianPriceM2: 6800 },
  { name: 'Centro', medianPriceM2: 6500 },
  { name: 'Portão', medianPriceM2: 6500 },
  { name: 'Boqueirão', medianPriceM2: 5200 },
  { name: 'Pinheirinho', medianPriceM2: 4800 },
  { name: 'Cajuru', medianPriceM2: 4200 },
] as const;

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL não definido no ambiente.');
  }
  const db = createDbClient({ connectionString });

  const rows = CURITIBA_NEIGHBORHOODS.map((n) => ({
    city: 'Curitiba',
    state: 'PR',
    name: n.name,
    boundary: null,
    // numeric() no drizzle aceita string; convertemos com toFixed pra evitar lixo float.
    medianPriceM2: n.medianPriceM2.toFixed(2),
    lastAggregatedAt: new Date(),
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
      },
    });

  // eslint-disable-next-line no-console
  console.log(`[seed:curitiba] ${rows.length} bairros sincronizados.`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[seed:curitiba] falhou:', err);
  process.exit(1);
});
