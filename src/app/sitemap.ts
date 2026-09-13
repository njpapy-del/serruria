import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { siteConfig } from "@/data/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/mentions-legales`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/politique-confidentialite`, lastModified, changeFrequency: "yearly", priority: 0.2 },
  ];

  // Une page par ville réellement desservie uniquement (voir siteConfig.villes).
  const villeRoutes: MetadataRoute.Sitemap = siteConfig.villes.map((ville) => ({
    url: `${SITE_URL}/serrurier/${ville.slug}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...villeRoutes];
}
