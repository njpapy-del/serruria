import { siteConfig } from "@/data/site-config";
import { Section, SectionHeading } from "@/components/ui/Section";

export function PricingSection() {
  return (
    <Section id="tarifs">
      <SectionHeading
        title="Des tarifs clairs avant intervention"
        description="Le tarif exact est confirmé avec vous avant le début de toute intervention."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {siteConfig.tarifs.map((tarif) => (
          <div
            key={tarif.id}
            className="card-elevated flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5"
          >
            <span className="font-semibold text-navy-800">{tarif.label}</span>
            <span className="font-bold text-amber-600">
              {tarif.priceFrom != null ? `À partir de ${tarif.priceFrom} €` : "À partir de XX €"}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">
        Le tarif exact est confirmé avant intervention.
      </p>
    </Section>
  );
}
