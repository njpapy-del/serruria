import { siteConfig } from "@/data/site-config";
import { Section, SectionHeading } from "@/components/ui/Section";

export function HowItWorks() {
  return (
    <Section className="bg-slate-50">
      <SectionHeading title="Comment ça marche ?" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {siteConfig.etapes.map((etape) => (
          <div key={etape.numero} className="rounded-2xl bg-white p-6 card-elevated">
            <span className="text-3xl font-extrabold text-amber-500">{etape.numero}</span>
            <h3 className="mt-3 text-lg font-bold text-navy-900">{etape.titre}</h3>
            <p className="mt-2 text-sm text-slate-500">{etape.description}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
