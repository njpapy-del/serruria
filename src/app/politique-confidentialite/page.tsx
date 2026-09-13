import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { siteConfig } from "@/data/site-config";
import { Section } from "@/components/ui/Section";

export const metadata: Metadata = buildMetadata({
  title: `Politique de confidentialité — ${siteConfig.brand.name}`,
  path: "/politique-confidentialite",
});

export default function PolitiqueConfidentialitePage() {
  return (
    <Section className="prose max-w-3xl">
      <h1 className="text-3xl font-extrabold text-navy-900">Politique de confidentialité</h1>

      <h2 className="mt-8 text-xl font-bold text-navy-900">Formulaire de contact</h2>
      <p className="mt-2 text-sm text-navy-700">
        Les informations transmises via le formulaire de rappel (nom, téléphone, ville, type de
        problème, message) sont utilisées uniquement pour vous recontacter au sujet de votre
        demande. Elles ne sont ni revendues ni utilisées à d&apos;autres fins.
      </p>

      <h2 className="mt-8 text-xl font-bold text-navy-900">Cookies et mesure d&apos;audience</h2>
      <p className="mt-2 text-sm text-navy-700">
        Ce site peut utiliser des cookies de mesure d&apos;audience (Google Analytics) et de
        suivi de conversion publicitaire (Google Ads), uniquement après votre consentement donné
        via le bandeau affiché lors de votre première visite. Vous pouvez modifier votre choix à
        tout moment en effaçant les cookies de votre navigateur.
      </p>

      <h2 className="mt-8 text-xl font-bold text-navy-900">Vos droits</h2>
      <p className="mt-2 text-sm text-navy-700">
        Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification et de
        suppression des données vous concernant. Pour l&apos;exercer, contactez-nous par téléphone.
      </p>
    </Section>
  );
}
