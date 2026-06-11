/**
 * Seed de bairros de Porto Alegre/RS com mediana de preço/m² (venda, apartamentos).
 *
 * Fonte dos números: dados públicos FIPEZAP / portais de anúncios 2025/2026.
 * Valores são aproximações iniciais — serão sobrescritos pelo agregador
 * assim que houver listings suficientes no banco.
 *
 * Idempotente: usa ON CONFLICT (city,state,name) DO UPDATE para re-rodar sem lixo.
 *
 * Execução: `pnpm -F @imovi/db seed:porto-alegre`
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
const PORTO_ALEGRE_NEIGHBORHOODS: readonly SeedRow[] = [
  { name: 'Moinhos de Vento', medianPriceM2: 12000 },
  { name: 'Bela Vista', medianPriceM2: 11000 },
  { name: "Mont'Serrat", medianPriceM2: 10500 },
  { name: 'Três Figueiras', medianPriceM2: 10500 },
  { name: 'Auxiliadora', medianPriceM2: 10000 },
  { name: 'Petrópolis', medianPriceM2: 9500 },
  { name: 'Rio Branco', medianPriceM2: 9000 },
  { name: 'Boa Vista', medianPriceM2: 9000 },
  { name: 'Chácara das Pedras', medianPriceM2: 9000 },
  { name: 'Higienópolis', medianPriceM2: 8500 },
  { name: 'Menino Deus', medianPriceM2: 8000 },
  { name: 'Bom Fim', medianPriceM2: 7800 },
  { name: 'Cidade Baixa', medianPriceM2: 7500 },
  { name: 'Jardim Botânico', medianPriceM2: 7500 },
  { name: 'Santana', medianPriceM2: 7200 },
  { name: 'Ipanema', medianPriceM2: 7200 },
  { name: 'Tristeza', medianPriceM2: 7000 },
  { name: 'Floresta', medianPriceM2: 6800 },
  { name: 'Jardim do Salso', medianPriceM2: 6800 },
  { name: 'Centro Histórico', medianPriceM2: 6500 },
  { name: 'Cristal', medianPriceM2: 6500 },
  { name: 'Passo da Areia', medianPriceM2: 6500 },
  { name: 'Vila Ipiranga', medianPriceM2: 6200 },
  { name: 'São João', medianPriceM2: 6200 },
  { name: 'Cavalhada', medianPriceM2: 5800 },
  { name: 'Camaquã', medianPriceM2: 5800 },
  { name: 'Teresópolis', medianPriceM2: 5500 },
  { name: 'Partenon', medianPriceM2: 5200 },
  { name: 'Sarandi', medianPriceM2: 4800 },
  { name: 'Restinga', medianPriceM2: 3500 },
] as const;

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL não definido no ambiente.');
  }
  const db = createDbClient({ connectionString });

  const rows = PORTO_ALEGRE_NEIGHBORHOODS.map((n) => ({
    city: 'Porto Alegre',
    state: 'RS',
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
  console.log(`[seed:porto-alegre] ${rows.length} bairros sincronizados.`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[seed:porto-alegre] falhou:', err);
  process.exit(1);
});
