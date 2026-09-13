import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { siteConfig } from "@/data/site-config";
import { buildMetadata } from "@/lib/seo";
import { PhoneCTA } from "@/components/ui/PhoneCTA";
import { QuoteCTA } from "@/components/ui/QuoteCTA";
import { ServicesSection } from "@/components/sections/ServicesSection";
import { FAQSection } from "@/components/sections/FAQSection";
import { LeadForm } from "@/components/sections/LeadForm";

// Une page n'est générée que pour les villes réellement listées dans
// siteConfig.villes — jamais de génération automatique en masse.
export function generateStaticParams() {
  return siteConfig.villes.map((ville) => ({ ville: ville.slug }));
}

function findVille(slug: string) {
  return siteConfig.villes.find((v) => v.slug === slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ville: string }>;
}): Promise<Metadata> {
  const { ville: slug } = await params;
  const ville = findVille(slug);
  if (!ville) return {};

  return buildMetadata({
    title: `Serrurier ${ville.nom} — ${siteConfig.brand.name}`,
    description: `Serrurier d'urgence à ${ville.nom} (${ville.departement}). Ouverture de porte, clé cassée, serrure bloquée. Devis gratuit, tarif confirmé avant intervention.`,
    path: `/serrurier/${ville.slug}`,
  });
}

export default async function VillePage({
  params,
}: {
  params: Promise<{ ville: string }>;
}) {
  const { ville: slug } = await params;
  const ville = findVille(slug);
  if (!ville) notFound();

  return (
    <>
      <section className="bg-navy-radial py-16 text-white lg:py-24">
        <div className="container-srr text-center">
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
            Serrurier à {ville.nom}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">
            {siteConfig.brand.name} intervient à {ville.nom} ({ville.departement})
            {ville.secteurs.length > 0 ? ` et dans les secteurs suivants : ${ville.secteurs.join(", ")}.` : "."}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <PhoneCTA location={`ville_${ville.slug}`} size="lg" />
            <QuoteCTA location={`ville_${ville.slug}`} />
          </div>
        </div>
      </section>

      <ServicesSection />
      <FAQSection />
      <LeadForm />
    </>
  );
}
