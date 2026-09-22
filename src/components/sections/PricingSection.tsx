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
            className="card-elevated flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5"
          >
            <span className="flex items-center gap-2 font-semibold text-navy-800">
              {tarif.label}
              {tarif.fixed ? (
                <span className="rounded-full bg-success-500/10 px-2 py-0.5 text-xs font-bold text-success-500">
                  Pas cher
                </span>
              ) : null}
            </span>
            <span className="whitespace-nowrap font-bold text-amber-600">
              {tarif.customText
                ? tarif.customText
                : tarif.priceFrom == null
                  ? "Sur devis"
                  : tarif.fixed
                    ? `${tarif.priceFrom} € prix fixe`
                    : `À partir de ${tarif.priceFrom} €`}
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
