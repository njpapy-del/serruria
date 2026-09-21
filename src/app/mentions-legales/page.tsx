import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { siteConfig } from "@/data/site-config";
import { Section } from "@/components/ui/Section";

export const metadata: Metadata = buildMetadata({
  title: `Mentions légales — ${siteConfig.brand.name}`,
  path: "/mentions-legales",
});

export default function MentionsLegalesPage() {
  const { legal, contact, brand } = siteConfig;
  const hasAnyLegalInfo = Boolean(legal.companyName || legal.siret || legal.address);

  return (
    <Section className="prose max-w-3xl">
      <h1 className="text-3xl font-extrabold text-navy-900">Mentions légales</h1>

      <div className="mt-6 space-y-2 text-sm text-navy-700">
        <p>Éditeur du site : {legal.companyName || brand.name}</p>
        {legal.siret ? <p>SIRET : {legal.siret}</p> : null}
        {legal.address ? <p>Adresse : {legal.address}</p> : null}
        <p>Téléphone : {contact.phoneDisplay}</p>
        {contact.email ? <p>Email : {contact.email}</p> : null}
      </div>

      {!legal.dataConfirmed ? (
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-navy-800">
          {hasAnyLegalInfo
            ? "Certaines informations légales (SIRET et/ou adresse) restent à compléter."
            : "Les informations légales complètes (raison sociale, SIRET, adresse) seront ajoutées ici dès qu'elles seront communiquées."}
        </p>
      ) : null}

      <h2 className="mt-8 text-xl font-bold text-navy-900">Hébergement</h2>
      <p className="mt-2 text-sm text-navy-700">
        Le site est hébergé par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA.
      </p>
    </Section>
  );
}
