import type { Metadata } from 'next';
import { ConsentResetButton } from '@/components/ads/ConsentResetButton';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { formatVersionDate, PRIVACY_VERSION } from '@/lib/terms-version';
import { tokens as C } from '@/lib/tokens';

export const runtime = 'edge';
export const metadata: Metadata = {
  title: 'Política de privacidade',
  description: 'Saiba como o imovi trata dados pessoais, cookies, pagamentos e publicidade.',
  alternates: { canonical: '/privacidade/' },
};

export default function PrivacidadePage() {
  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      <Nav />
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '7rem 1.25rem 4rem' }}>
        <h1
          style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', marginBottom: '1rem' }}
        >
          Privacidade e cookies
        </h1>
        <p style={{ color: C.text2, lineHeight: 1.75, marginBottom: '2rem' }}>
          Esta página descreve, em linguagem direta, como o imovi trata dados no site público e no
          produto de auditoria. Última atualização: {formatVersionDate(PRIVACY_VERSION)}.
        </p>
        {[
          [
            'Dados fornecidos por você',
            'Dados de cadastro, organização, imóveis e integrações são usados para entregar estimativas e auditorias, autenticar usuários, prestar suporte e administrar a assinatura.',
          ],
          [
            'Resultados públicos e lista de espera',
            'Armazenamos os parâmetros do imóvel e a estimativa para consulta por uma referência pública não sequencial. Qualquer pessoa com o link pode ver esses parâmetros e o resultado; não informe dados pessoais. Salvamos o e-mail da lista de espera somente após consentimento. Você pode solicitar sua remoção pelo contato no rodapé.',
          ],
          [
            'Registro do aceite dos termos',
            'Quando você aceita os Termos de uso e esta Política, guardamos o identificador da sua conta, a versão dos Termos de uso, a versão desta Política, a origem do aceite (cadastro da conta ou da imobiliária) e a data e hora do aceite. Usamos esse registro para comprovar o aceite e o contrato firmado com você. A base legal é a execução de contrato e o cumprimento de obrigação legal (LGPD, art. 7º, incisos V e II). Mantemos o registro enquanto a conta existir e, depois disso, pelo prazo prescricional aplicável. Quando os documentos mudam, um novo aceite é registrado e cada versão aceita fica preservada no histórico.',
          ],
          [
            'Dados técnicos',
            'Podemos registrar endereço IP, agente do navegador, eventos de segurança, falhas e métricas agregadas necessárias para proteger e operar o serviço.',
          ],
          [
            'Pagamentos',
            'A cobrança é processada pela Stripe. O imovi não armazena o número completo do cartão; conserva identificadores do cliente e da assinatura para controlar o acesso.',
          ],
          [
            'Publicidade',
            'Anúncios aparecem somente em áreas gratuitas e apenas depois da sua escolha. A configuração inicial solicita anúncios não personalizados. O Google ainda pode usar identificadores para entrega, limitação de frequência, medição agregada e prevenção de fraude.',
          ],
          [
            'Compartilhamento e retenção',
            'Dados são compartilhados somente com operadores necessários à prestação do serviço, como hospedagem, banco, e-mail, cobrança e publicidade. Mantemos os dados pelo prazo necessário ao serviço, obrigações legais e defesa de direitos.',
          ],
          [
            'Seus direitos',
            'Você pode solicitar confirmação, acesso, correção, portabilidade quando aplicável, eliminação, informação sobre compartilhamento e revogação de consentimento. Entre em contato pelo e-mail indicado no rodapé.',
          ],
          [
            'Segurança',
            'Aplicamos controle de acesso por organização, validação de webhooks, armazenamento de segredos fora do código e registros de auditoria. Nenhuma medida elimina todos os riscos.',
          ],
        ].map(([title, text]) => (
          <section key={title} style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', color: C.text, marginBottom: '0.4rem' }}>{title}</h2>
            <p style={{ color: C.text2, lineHeight: 1.7, fontSize: '0.9rem' }}>{text}</p>
          </section>
        ))}
        <ConsentResetButton />
      </main>
      <Footer />
    </div>
  );
}
