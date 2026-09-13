import { siteConfig } from "@/data/site-config";
import { Section, SectionHeading } from "@/components/ui/Section";
import { MapPin } from "lucide-react";

export function ZonesSection() {
  const villes = siteConfig.villes;

  return (
    <Section id="zones">
      <SectionHeading
        title="Un serrurier près de chez vous"
        description={
          villes.length === 0
            ? "Les zones d'intervention seront précisées ici prochainement."
            : undefined
        }
      />

      {villes.length === 0 ? null : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {villes.map((ville) => (
            <div key={ville.slug} className="rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-2 font-bold text-navy-900">
                <MapPin className="h-5 w-5 text-amber-500" aria-hidden="true" />
                {ville.nom}
              </div>
              <p className="mt-1 text-sm text-slate-500">{ville.departement}</p>
              {ville.secteurs.length > 0 && (
                <p className="mt-3 text-sm text-slate-500">{ville.secteurs.join(", ")}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
