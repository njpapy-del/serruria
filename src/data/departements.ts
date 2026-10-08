// Départements d'intervention affichés sur la carte de l'équipe.
// Contours : france-geojson (gregoiredavid), version simplifiée, filtrée sur
// les 8 départements desservis — voir `departements-idf.json`.

import geo from "./departements-idf.json";
import { siteConfig } from "./site-config";

export type Departement = {
  code: string;
  nom: string;
  color: string;
  /** Page /serrurier/{slug} correspondante (siteConfig.villes). */
  slug?: string;
};

const COLORS: Record<string, string> = {
  "75": "#f59e0b",
  "77": "#10b981",
  "78": "#06b6d4",
  "91": "#84cc16",
  "92": "#3b82f6",
  "93": "#8b5cf6",
  "94": "#ec4899",
  "95": "#6366f1",
};

export const departementsGeo = geo as GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  { code: string; nom: string; label: [number, number] }
>;

export const departements: Departement[] = departementsGeo.features
  .map((f) => ({
    code: f.properties.code,
    nom: f.properties.nom,
    color: COLORS[f.properties.code] ?? "#64748b",
    slug: siteConfig.villes.find((v) => v.departement.includes(`${f.properties.code}`))?.slug,
  }))
  .sort((a, b) => a.code.localeCompare(b.code));

export function departementByCode(code: string) {
  return departements.find((d) => d.code === code);
}
