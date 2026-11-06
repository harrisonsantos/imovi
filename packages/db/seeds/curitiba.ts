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
  // Bairros adicionais frequentes nos portais (Zap/OLX/VivaReal) — medianas
  // aproximadas FipeZap/anúncios Q4/2025; recalculadas pelo agregador depois.
  { name: 'Ecoville', medianPriceM2: 9200 },
  { name: 'Vila Izabel', medianPriceM2: 7800 },
  { name: 'Seminário', medianPriceM2: 7600 },
  { name: 'Jardim Botânico', medianPriceM2: 7200 },
  { name: 'Bacacheri', medianPriceM2: 7000 },
  { name: 'Tarumã', medianPriceM2: 6500 },
  { name: 'Tingui', medianPriceM2: 6300 },
  { name: 'Santa Quitéria', medianPriceM2: 6200 },
  { name: 'Guabirotuba', medianPriceM2: 6200 },
  { name: 'Prado Velho', medianPriceM2: 5800 },
  { name: 'Capão da Imbuia', medianPriceM2: 5800 },
  { name: 'São Braz', medianPriceM2: 5800 },
  { name: 'Hauer', medianPriceM2: 5600 },
  { name: 'Fazendinha', medianPriceM2: 5400 },
  { name: 'Barreirinha', medianPriceM2: 5400 },
  { name: 'Uberaba', medianPriceM2: 5300 },
  { name: 'Xaxim', medianPriceM2: 5200 },
  { name: 'Santa Cândida', medianPriceM2: 5200 },
  { name: 'Bairro Alto', medianPriceM2: 5100 },
  { name: 'Lindóia', medianPriceM2: 5000 },
  { name: 'Campo Comprido', medianPriceM2: 5000 },
  { name: 'Butiatuvinha', medianPriceM2: 4900 },
  { name: 'Cidade Industrial', medianPriceM2: 4300 },
  { name: 'Sítio Cercado', medianPriceM2: 4200 },
  { name: 'Campo de Santana', medianPriceM2: 3900 },
  { name: 'Umbará', medianPriceM2: 3900 },
  // Cobertura completa dos bairros vistos nos dados reais (backfill round 2)
  { name: 'Mossunguê', medianPriceM2: 9000 },
  { name: 'Centro Cívico', medianPriceM2: 8200 },
  { name: 'Alto da Glória', medianPriceM2: 8000 },
  { name: 'Alto da Rua XV', medianPriceM2: 9000 },
  { name: 'Jardim das Américas', medianPriceM2: 6500 },
  { name: 'Campina do Siqueira', medianPriceM2: 6800 },
  { name: 'Vista Alegre', medianPriceM2: 6500 },
  { name: 'São Lourenço', medianPriceM2: 6800 },
  { name: 'Bom Retiro', medianPriceM2: 6500 },
  { name: 'Santo Inácio', medianPriceM2: 6800 },
  { name: 'Pilarzinho', medianPriceM2: 5600 },
  { name: 'Abranches', medianPriceM2: 5200 },
  { name: 'Guaíra', medianPriceM2: 5300 },
  { name: 'Fanny', medianPriceM2: 5200 },
  { name: 'Novo Mundo', medianPriceM2: 5100 },
  { name: 'Capão Raso', medianPriceM2: 5000 },
  { name: 'Atuba', medianPriceM2: 5000 },
  { name: 'Augusta', medianPriceM2: 4300 },
  { name: 'Tatuquara', medianPriceM2: 3800 },
  // Demais bairros oficiais de Curitiba ainda não cobertos
  { name: 'Bairro Cachoeira', medianPriceM2: 4300 },
  { name: 'Caximba', medianPriceM2: 3500 },
  { name: 'Cascatinha', medianPriceM2: 7500 },
  { name: 'Ganchinho', medianPriceM2: 3700 },
  { name: 'Lamenha Pequena', medianPriceM2: 4000 },
  { name: 'Orleans', medianPriceM2: 5200 },
  { name: 'Parolin', medianPriceM2: 4500 },
  { name: 'Riviera', medianPriceM2: 4000 },
  { name: 'Santa Bárbara', medianPriceM2: 4500 },
  { name: 'São João', medianPriceM2: 5800 },
  { name: 'São Miguel', medianPriceM2: 3900 },
  { name: 'Taboão', medianPriceM2: 5500 },
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

  // eslint-disable-next-line no-console
  console.log(`[seed:curitiba] ${rows.length} bairros sincronizados.`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[seed:curitiba] falhou:', err);
  process.exit(1);
});
