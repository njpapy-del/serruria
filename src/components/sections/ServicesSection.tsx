import { siteConfig } from "@/data/site-config";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Wrench } from "lucide-react";

export function ServicesSection() {
  return (
    <Section id="services">
      <SectionHeading title="Nos services de serrurerie" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {siteConfig.services.map((service) => (
          <div key={service.id} className="rounded-2xl border border-slate-200 p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-900/5 text-navy-900">
              <Wrench className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="mt-4 font-bold text-navy-900">{service.label}</h3>
            <p className="mt-2 text-sm text-slate-500">{service.description}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
