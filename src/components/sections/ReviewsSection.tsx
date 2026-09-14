import { siteConfig, type Avis } from "@/data/site-config";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Star } from "lucide-react";

// Trois avis d'exemple, visuellement identifiés comme placeholders. Ils
// disparaissent automatiquement dès que de vrais avis sont ajoutés dans
// `siteConfig.avis` — on n'affiche jamais un avis d'exemple à côté de vrais avis.
const EXAMPLE_AVIS: Avis[] = [
  { prenom: "Prénom", ville: "Ville", note: 5, commentaire: "Exemple de mise en forme d'un avis client." },
  { prenom: "Prénom", ville: "Ville", note: 5, commentaire: "Exemple de mise en forme d'un avis client." },
  { prenom: "Prénom", ville: "Ville", note: 5, commentaire: "Exemple de mise en forme d'un avis client." },
];

export function ReviewsSection() {
  const hasRealAvis = siteConfig.avis.length > 0;
  const avisToShow = hasRealAvis ? siteConfig.avis : EXAMPLE_AVIS;

  return (
    <Section id="avis" className="bg-slate-50">
      <SectionHeading title="Avis clients" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {avisToShow.map((avis, index) => (
          <div key={index} className="relative rounded-2xl bg-white p-6 card-elevated">
            {!hasRealAvis && (
              <span className="absolute right-4 top-4 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                Exemple
              </span>
            )}
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${i < avis.note ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
                />
              ))}
            </div>
            {avis.titre ? (
              <p className="mt-3 font-bold text-navy-900">{avis.titre}</p>
            ) : null}
            <p className="mt-2 text-sm text-slate-600">&laquo; {avis.commentaire} &raquo;</p>
            <p className="mt-4 text-sm font-semibold text-navy-800">
              {avis.prenom} — {avis.ville}
            </p>
          </div>
        ))}
      </div>
      {!hasRealAvis && (
        <p className="mt-6 text-center text-sm text-slate-500">
          Les avis clients réels de {siteConfig.brand.name} seront affichés ici prochainement.
        </p>
      )}
    </Section>
  );
}
