import PlateNav from "@/components/PlateNav";
import Hero from "@/components/Hero";
import ProblemShift from "@/components/ProblemShift";
import HowItWorks from "@/components/HowItWorks";
import SystemValue from "@/components/SystemValue";
import Proof from "@/components/Proof";
import SprintDetails from "@/components/SprintDetails";
import FAQ from "@/components/FAQ";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";
import { site, sprint } from "@/lib/content";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: site.name,
  slogan: site.ogHeadline,
  description: site.description,
  url: site.url,
  image: `${site.url}/opengraph-image`,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Mumbai",
    addressCountry: "IN",
  },
  areaServed: [
    { "@type": "City", name: "Mumbai" },
    { "@type": "Country", name: "India" },
  ],
  makesOffer: {
    "@type": "Offer",
    itemOffered: {
      "@type": "Service",
      name: "Calibration Sprint",
      description: sprint.heading,
    },
  },
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PlateNav />
      <main id="top">
        <Hero />
        <ProblemShift />
        <HowItWorks />
        <SystemValue />
        <Proof />
        <SprintDetails />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
