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
    name: legal.companyName || brand.name,
    url: SITE_URL,
    telephone: contact.phoneDisplay,
    email: contact.email || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: legal.address,
    },
    ...(siteConfig.villes.length > 0
      ? { areaServed: siteConfig.villes.map((v) => v.nom) }
      : {}),
  };
}
