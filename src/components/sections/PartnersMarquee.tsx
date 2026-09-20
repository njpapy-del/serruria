import { siteConfig } from "@/data/site-config";

// Logos statiques (SVG/JPG) : une simple balise <img> évite de configurer
// l'optimiseur next/image pour du SVG, inutile ici (fichiers déjà légers).
/* eslint-disable @next/next/no-img-element */

export function PartnersMarquee() {
  const partners = siteConfig.partners;
  if (!partners || partners.length === 0) return null;

  return (
    <section className="border-b border-slate-200 bg-white py-6" aria-label="Nos partenaires">
      <p className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
        Nos partenaires
      </p>
      <div className="overflow-hidden">
        <div className="marquee-track flex w-max items-center">
          {[...partners, ...partners].map((partner, i) => (
            <span
              key={`${partner.name}-${i}`}
              className="mx-8 flex h-10 w-28 flex-shrink-0 items-center justify-center"
            >
              <img src={partner.logo} alt={partner.name} className="max-h-10 w-auto object-contain" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
