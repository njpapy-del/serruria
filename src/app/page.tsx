import { Hero } from "@/components/sections/Hero";
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
  return (
    <>
      <Hero />
      <ProblemGrid />
      <UrgencySection />
      <PricingSection />
      <HowItWorks />
      <ServicesSection />
      <TrustSection />
      <ReviewsSection />
      <ZonesSection />
      <FAQSection />
      <LeadForm />
    </>
  );
}
