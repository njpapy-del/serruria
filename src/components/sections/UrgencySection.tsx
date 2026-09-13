import { siteConfig } from "@/data/site-config";
import { PhoneCTA } from "@/components/ui/PhoneCTA";
import { QuoteCTA } from "@/components/ui/QuoteCTA";

export function UrgencySection() {
  return (
    <section className="bg-navy-900 py-16 text-white lg:py-20">
      <div className="container-srr flex flex-col items-center gap-6 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight lg:text-4xl">
          Besoin d&apos;un serrurier maintenant ?
        </h2>
        <p className="max-w-xl text-lg text-slate-300">
          Décrivez-nous votre situation : nous vous accompagnons pour {siteConfig.brand.positioning.toLowerCase()}.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <PhoneCTA location="urgency_section" size="lg" />
          <QuoteCTA location="urgency_section" label="DEMANDER UN DEVIS" />
        </div>
      </div>
    </section>
  );
}
