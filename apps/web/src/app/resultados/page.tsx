import Link from 'next/link';
import { z } from 'zod';
import { estimateRepo } from '@imovi/db/estimates';
import { getCfEnv } from '@/lib/cf-env';
import { getDb } from '@/lib/db';
import { publicEstimateOf, sourceDescription } from '@/lib/public-estimate';
import { Nav } from '@/components/Nav';
import { tokens as C } from '@/lib/tokens';

export const runtime = 'edge';
const brl = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const propertyLabels = {
  apartment: 'Apartamento',
  house: 'Casa',
  commercial: 'Comercial',
  land: 'Terreno',
};

export default async function ResultadosPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  let result = null;
  let error = 'Gere uma estimativa para acessar seu resultado.';
  if (id && z.string().uuid().safeParse(id).success) {
    try {
      const env = await getCfEnv();
      const row = await estimateRepo.findById(getDb(env.DATABASE_URL), id);
      result = row ? publicEstimateOf(row) : null;
      error = 'Estimativa não encontrada. Gere uma nova estimativa.';
    } catch {
      error = 'Não foi possível recuperar sua estimativa. Tente novamente mais tarde.';
    }
  } else if (id) {
    error = 'A referência desta estimativa é inválida.';
  }
  return (
    <>
      <Nav />
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '7rem 1.5rem 4rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>Resultado da estimativa</h1>
        {!result ? (
          <p role="alert">{error}</p>
        ) : (
          <article
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: '16px',
              padding: '2rem',
            }}
          >
            <p>{result.neighborhood.name} · Estimativa heurística</p>
            <p>
              {propertyLabels[result.property.propertyType]} · {result.property.city}/
              {result.property.state} · {result.property.area} m².
            </p>
            <p>
              Quartos: {result.property.bedrooms ?? 'não informado'} · Banheiros:{' '}
              {result.property.bathrooms ?? 'não informado'} · Vagas:{' '}
              {result.property.parking ?? 'não informado'}.
            </p>
            <h2 style={{ fontSize: '2.5rem', margin: '1rem 0' }}>{brl(result.estimate)}</h2>
            <p>
              Faixa indicativa: {brl(result.confidenceLow)} a {brl(result.confidenceHigh)}.
            </p>
            <p style={{ marginTop: '1rem' }}>
              A faixa de ±30% é uma margem fixa da heurística, sem nível de confiança estatístico
              validado. Esta referência não substitui avaliação profissional.
            </p>
            <p style={{ marginTop: '1rem' }}>
              Referência do bairro: {brl(result.neighborhood.medianPriceM2)}/m².
            </p>
            <p>Preço estimado por m²: {brl(result.estimate / result.property.area)}.</p>
            <p style={{ marginTop: '1rem' }}>{sourceDescription(result.dataSource)}</p>
            <p>
              Atualização da referência:{' '}
              {result.dataSource.updatedAt
                ? new Date(result.dataSource.updatedAt).toLocaleDateString('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                  })
                : 'não disponível'}
              .
            </p>
            <p>
              Gerada em{' '}
              {new Date(result.generatedAt).toLocaleString('pt-BR', {
                timeZone: 'America/Sao_Paulo',
              })}{' '}
              · {result.modelVersion}.
            </p>
            <p style={{ marginTop: '1rem', color: C.text2 }}>
              A referência pública permite recuperar este resultado. Compartilhe o link somente se
              desejar divulgar os parâmetros do imóvel.
            </p>
          </article>
        )}
        <Link
          href="/#estimar"
          style={{ display: 'inline-block', marginTop: '2rem', color: C.accent }}
        >
          Gerar nova estimativa →
        </Link>
      </main>
    </>
  );
}
