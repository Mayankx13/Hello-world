import type { Metadata } from 'next';
import { stateConfigs } from '@/config/states';
import LandingPage from '@/components/landing/LandingPage';

const config = stateConfigs.delhi;

export const metadata: Metadata = {
  title: config.metaTitle,
  description: config.metaDescription,
  keywords: 'BSc Nursing Delhi, nursing college for Delhi students Punjab, cheaper nursing college Delhi, NCLEX nursing college North India, clean campus nursing college Delhi',
  openGraph: {
    title: config.metaTitle,
    description: config.metaDescription,
    images: [{ url: config.ogImage, width: 1200, height: 630, alt: config.metaTitle }],
    type: 'website',
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: config.metaTitle,
    description: config.metaDescription,
    images: [config.ogImage],
  },
};

export default function DelhiPage() {
  return <LandingPage config={config} />;
}
