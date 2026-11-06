import type { Metadata } from 'next';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { formatVersionDate, TERMS_VERSION } from '@/lib/terms-version';
import { tokens as C } from '@/lib/tokens';

export const runtime = 'edge';
export const metadata: Metadata = {
  title: 'Termos de uso',
  description: 'Condições de uso das estimativas, contas, trials e assinaturas do imovi.',
  alternates: { canonical: '/termos/' },
};

export default function TermosPage() {
  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      <Nav />
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '7rem 1.25rem 4rem' }}>
        <h1
          style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', marginBottom: '1rem' }}
        >
          Termos de uso
        </h1>
        <p style={{ color: C.text2, lineHeight: 1.75, marginBottom: '2rem' }}>
          Condições essenciais para uso do imovi. Última atualização:{' '}
          {formatVersionDate(TERMS_VERSION)}.
        </p>
        {[
          [
            'Natureza das estimativas',
            'Os valores são estimativas automatizadas baseadas nos dados disponíveis e não constituem laudo técnico, garantia de preço de venda, recomendação de investimento ou aconselhamento jurídico.',
          ],
          [
            'Conta e organização',
            'Você deve fornecer informações corretas, proteger suas credenciais e usar somente dados e integrações que tenha autorização para tratar. Atividades realizadas na conta são de responsabilidade de seus administradores.',
          ],
          [
            'Assinaturas',
            'Planos pagos são recorrentes e cobrados antecipadamente conforme o ciclo exibido no checkout. Alterações, cancelamentos, faturas e meios de pagamento podem ser administrados pelo portal de cobrança.',
          ],
          [
            'Trial e cancelamento',
            'O período gratuito informado na contratação termina na data indicada. O cancelamento impede novas renovações, sem apagar automaticamente dados ou antecipar reembolso, salvo obrigação legal ou condição expressa no checkout.',
          ],
          [
            'Uso aceitável',
            'É proibido contornar limites, automatizar abuso do serviço, violar sistemas de terceiros, revender acesso sem autorização ou usar os resultados para discriminação ilícita.',
          ],
          [
            'Disponibilidade e mudanças',
            'Podemos corrigir, atualizar ou descontinuar funcionalidades, preservando direitos já adquiridos e comunicando mudanças materiais nos planos pagos quando aplicável.',
          ],
          [
            'Responsabilidade',
            'Cada decisão imobiliária exige validação profissional e documental. A responsabilidade do imovi fica limitada na extensão permitida pela legislação aplicável.',
          ],
        ].map(([title, text]) => (
          <section key={title} style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', color: C.text, marginBottom: '0.4rem' }}>{title}</h2>
            <p style={{ color: C.text2, lineHeight: 1.7, fontSize: '0.9rem' }}>{text}</p>
          </section>
        ))}
      </main>
      <Footer />
    </div>
  );
}
