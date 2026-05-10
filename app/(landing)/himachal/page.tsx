import type { Metadata } from 'next';
import { stateConfigs } from '@/config/states';
import LandingPage from '@/components/landing/LandingPage';

const config = stateConfigs.himachal;

export const metadata: Metadata = {
  title: config.metaTitle,
  description: config.metaDescription,
  keywords: 'BSc Nursing Himachal Pradesh, nursing college Shimla, nursing college Mandi, nursing college Kangra, nursing college Punjab, INC approved nursing HP',
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
  other: {
    // Schema.org EducationalOrganization + Course markup
    'application-ld+json': JSON.stringify([
      {
        '@context': 'https://schema.org',
        '@type': 'EducationalOrganization',
        name: 'Desh Bhagat Nursing College',
        description: 'INC Approved, NMC Recognized B.Sc Nursing College in Punjab',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Fatehgarh Sahib',
          addressRegion: 'Punjab',
          addressCountry: 'IN',
        },
        url: 'https://dbnc.edu.in',
        telephone: '+91 98765 43210',
        sameAs: [
          'https://instagram.com/dbnc_official',
          'https://facebook.com/dbnc.official',
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Course',
        name: 'Bachelor of Science in Nursing (B.Sc Nursing)',
        description: 'INC approved 4-year B.Sc Nursing programme at Punjab campus',
        provider: {
          '@type': 'EducationalOrganization',
          name: 'Desh Bhagat Nursing College',
        },
        courseCode: 'BSCN-2025',
        educationalLevel: 'Bachelor',
        timeRequired: 'P4Y',
        offers: {
          '@type': 'Offer',
          price: '95000',
          priceCurrency: 'INR',
          description: 'Annual tuition fee',
        },
      },
    ]),
  },
};

export default function HimachalPage() {
  return <LandingPage config={config} />;
}
