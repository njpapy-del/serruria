import { siteConfig } from "@/data/site-config";
import { Section, SectionHeading } from "@/components/ui/Section";
import { CheckCircle2 } from "lucide-react";

export function TrustSection() {
  return (
    <Section id="confiance" className="bg-slate-50">
      <SectionHeading title={`Pourquoi choisir ${siteConfig.brand.name} ?`} />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {siteConfig.confiance.map((item) => (
          <div key={item.label} className="rounded-2xl bg-white p-6 card-elevated">
            <CheckCircle2 className="h-6 w-6 text-amber-500" aria-hidden="true" />
            <h3 className="mt-3 font-bold text-navy-900">{item.label}</h3>
            <p className="mt-2 text-sm text-slate-500">{item.description}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
