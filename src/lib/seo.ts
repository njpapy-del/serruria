import type { Metadata } from "next";
import { siteConfig } from "@/data/site-config";

export const SITE_URL = siteConfig.siteUrl;

export function buildMetadata({
  title,
  description,
  path = "/",
}: {
  title: string;
  description?: string;
  path?: string;
}): Metadata {
  const desc =
    description ??
    `${siteConfig.brand.positioning}. ${siteConfig.hero.subtitle}`;
  const url = `${SITE_URL}${path}`;

  return {
    title,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: desc,
      url,
      siteName: siteConfig.brand.name,
      locale: "fr_FR",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
    },
  };
}

/**
 * Données structurées LocalBusiness/Locksmith.
 * Retourne `null` tant que `siteConfig.legal.dataConfirmed` n'est pas passé à
 * `true` — on ne publie jamais de fausses coordonnées d'entreprise.
 */
export function localBusinessJsonLd() {
  const { legal, contact, brand } = siteConfig;
  if (!legal.dataConfirmed) return null;

  return {
    "@context": "https://schema.org",
    "@type": "Locksmith",
    name: brand.name,
    legalName: legal.companyName || undefined,
    url: SITE_URL,
    telephone: toE164(contact.phoneHref),
    email: contact.email || undefined,
    address: postalAddress(legal.address),
    ...(siteConfig.villes.length > 0
      ? {
          areaServed: siteConfig.villes.map((v) => ({
            "@type": "AdministrativeArea",
            name: v.nom,
          })),
        }
      : {}),
  };
}

/** "tel:0185500270" -> "+33185500270". */
function toE164(telHref: string): string {
  const digits = telHref.replace(/\D/g, "");
  return digits.startsWith("0") ? `+33${digits.slice(1)}` : `+${digits}`;
}

/**
 * Découpe "12 Rue X, 93300 Aubervilliers, France" en adresse structurée.
 * Repli sur l'adresse brute si le format n'est pas reconnu.
 */
function postalAddress(raw: string) {
  const match = raw.match(/^(.+?),\s*(\d{5})\s+([^,]+?)(?:,\s*France)?$/i);
  if (!match) return { "@type": "PostalAddress", streetAddress: raw, addressCountry: "FR" };
  const [, streetAddress, postalCode, addressLocality] = match;
  return { "@type": "PostalAddress", streetAddress, postalCode, addressLocality, addressCountry: "FR" };
}
