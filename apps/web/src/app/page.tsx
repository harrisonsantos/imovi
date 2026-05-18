import { Nav }          from '@/components/Nav';
import { Hero }         from '@/components/Hero';
import { HowItWorks }   from '@/components/HowItWorks';
import { EstimateForm } from '@/components/EstimateForm';
import { DataViz }      from '@/components/DataViz';
import { FAQ }          from '@/components/FAQ';
import { Footer }       from '@/components/Footer';

export const runtime = 'edge';

export default function HomePage() {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  return (
    <>
      <Nav />
      <Hero />
      <HowItWorks />
      <EstimateForm siteKey={turnstileSiteKey} />
      <DataViz />
      <FAQ />
      <Footer />
    </>
  );
}
