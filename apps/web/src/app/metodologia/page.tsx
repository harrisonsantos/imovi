import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { tokens as C } from '@/lib/tokens';


export default function MetodologiaPage() {
  return (
    <>
      <Nav />
      <main
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '7rem 1.5rem 4rem',
          lineHeight: 1.8,
        }}
      >
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>Como calculamos a estimativa</h1>
        <p>
          A versão atual usa uma heurística: referência de preço por m² do bairro multiplicada pela
          área e por ajustes fixos de tipo, quartos, banheiros e vagas.
        </p>
        <h2 style={{ marginTop: '2rem' }}>Referência e atualização</h2>
        <p>
          Cada resultado informa a origem, a quantidade de imóveis distintos e a data de
          atualização. Referências iniciais aproximadas são identificadas. Uma mediana de anúncios
          exige pelo menos vinte imóveis válidos de venda; anúncios representam preços pedidos, não
          transações concluídas.
        </p>
        <h2 style={{ marginTop: '2rem' }}>Ajustes da heurística</h2>
        <p>
          Apartamentos usam fator 1; casas 1,15; comerciais 0,9; terrenos 0,5. Cada quarto acima ou
          abaixo de dois ajusta 4%; cada banheiro acima ou abaixo de um ajusta 3%; cada vaga soma
          5%. Os fatores são multiplicados. Campos opcionais ausentes usam dois quartos, um banheiro
          e nenhuma vaga.
        </p>
        <h2 style={{ marginTop: '2rem' }}>Limitações</h2>
        <p>
          A faixa exibida é uma margem fixa de ±30%. Não é um intervalo estatístico calibrado, e não
          há precisão ou latência garantida. Conservação, localização exata, idade, documentação e
          condições da negociação podem alterar bastante o valor.
        </p>
        <p>
          O modelo de aprendizado de máquina permanece desativado até comprovar qualidade temporal e
          funcionamento real no ambiente de publicação. Comparáveis, preços de vendas e históricos
          não são apresentados sem dados verificáveis.
        </p>
        <p>
          As estimativas e os parâmetros do imóvel são armazenados para permitir recuperar o
          resultado por uma referência pública. Não envie dados pessoais no formulário.
        </p>
        <Link
          href="/#estimar"
          style={{ display: 'inline-block', marginTop: '2rem', color: C.accent }}
        >
          Estimar valor →
        </Link>
      </main>
    </>
  );
}
