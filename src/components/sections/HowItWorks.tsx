import { siteConfig } from "@/data/site-config";
import { Section, SectionHeading } from "@/components/ui/Section";
import { PhoneCTA } from "@/components/ui/PhoneCTA";
import { WhatsAppCTA } from "@/components/ui/WhatsAppCTA";
import { QuoteCTA } from "@/components/ui/QuoteCTA";

export function HowItWorks() {
  return (
    <Section id="etapes" className="bg-slate-50">
      <SectionHeading title="Comment demander une intervention ?" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {siteConfig.etapes.map((etape) => (
          <div key={etape.numero} className="rounded-2xl bg-white p-6 card-elevated">
            <span className="text-3xl font-extrabold text-amber-500">{etape.numero}</span>
            <h3 className="mt-3 text-lg font-bold text-navy-900">{etape.titre}</h3>
            <p className="mt-2 text-sm text-slate-500">{etape.description}</p>
          </div>
        ))}
      </div>
      <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <PhoneCTA location="etapes" size="md" />
        <WhatsAppCTA location="etapes" size="md" />
        <QuoteCTA
          location="etapes"
          className="inline-flex items-center justify-center rounded-full border-2 border-navy-900 px-5 py-3 font-bold text-navy-900 transition-colors hover:bg-navy-900/5"
        />
      </div>
    </Section>
  );
}
