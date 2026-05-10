import type { Metadata } from 'next';
import { stateConfigs } from '@/config/states';
import LandingPage from '@/components/landing/LandingPage';

const config = stateConfigs.jammu;

export const metadata: Metadata = {
  title: config.metaTitle,
  description: config.metaDescription,
  keywords: 'BSc Nursing Jammu, nursing college Jammu, J&K nursing admission, PMSSS nursing scholarship, nursing college Punjab near Jammu',
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

export default function JammuPage() {
  return <LandingPage config={config} />;
}
