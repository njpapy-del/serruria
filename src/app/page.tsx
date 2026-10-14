import { Hero } from "@/components/sections/Hero";
import { PartnersMarquee } from "@/components/sections/PartnersMarquee";
import { ProblemGrid } from "@/components/sections/ProblemGrid";
import { UrgencySection } from "@/components/sections/UrgencySection";
import { PricingSection } from "@/components/sections/PricingSection";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { ServicesSection } from "@/components/sections/ServicesSection";
import { TrustSection } from "@/components/sections/TrustSection";
import { ReviewsSection } from "@/components/sections/ReviewsSection";
import { ZonesSection } from "@/components/sections/ZonesSection";
import { FAQSection } from "@/components/sections/FAQSection";
import { LeadForm } from "@/components/sections/LeadForm";

export default function HomePage() {
  // Ordre pensé pour la conversion : urgences → prestations → tarifs →
  // zone → démarche → réassurance → FAQ → formulaire et coordonnées.
  return (
    <>
      <Hero />
      <PartnersMarquee />
      <ProblemGrid />
      <ServicesSection />
      <PricingSection />
      <UrgencySection />
      <ZonesSection />
      <HowItWorks />
      <TrustSection />
      <ReviewsSection />
      <FAQSection />
      <LeadForm />
    </>
  );
}
