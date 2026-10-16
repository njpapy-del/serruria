// Localisation d'une demande en Île-de-France à partir de son texte.
// Données : communes de la région 11 (API Géo, geo.api.gouv.fr — Etalab 2.0),
// voir `src/data/communes-idf.json` : [nom, département, codes postaux, lat, lng].

import communesData from "@/data/communes-idf.json";
import { normalize } from "./text";

export type Commune = {
  nom: string;
  departement: string;
  codesPostaux: string[];
  lat: number;
  lng: number;
};

export type Localisation =
  | { kind: "commune"; commune: Commune; via: "code_postal" | "nom"; matched: string }
  | { kind: "departement"; departement: string; matched: string }
  | { kind: "hors_idf"; matched: string }
  | { kind: "inconnue" };

export const COMMUNES: Commune[] = (communesData as [string, string, string[], number, number][]).map(
  ([nom, departement, codesPostaux, lat, lng]) => ({ nom, departement, codesPostaux, lat, lng })
);

const BY_POSTCODE = new Map<string, Commune>();
for (const c of COMMUNES) {
  for (const cp of c.codesPostaux) if (!BY_POSTCODE.has(cp)) BY_POSTCODE.set(cp, c);
}

// Noms trop courts ou trop courants pour être reconnus seuls dans un texte libre
// (ex. la commune « Us » dans le 95). Ils restent reconnus par code postal.
const NAME_STOPLIST = new Set(["us", "ver"]);

const BY_NAME: { key: string; commune: Commune }[] = COMMUNES.map((commune) => ({
  key: normalize(commune.nom),
  commune,
}))
  .filter(({ key }) => key.length >= 4 && !NAME_STOPLIST.has(key))
  // Le plus long d'abord : « Saint-Maur-des-Fossés » avant « Saint-Maur ».
  .sort((a, b) => b.key.length - a.key.length);

const PARIS = COMMUNES.find((c) => c.nom === "Paris")!;

const DEPARTEMENT_NAMES: Record<string, string[]> = {
  "75": ["paris"],
  "77": ["seine et marne"],
  "78": ["yvelines"],
  "91": ["essonne"],
  "92": ["hauts de seine"],
  "93": ["seine saint denis"],
  "94": ["val de marne"],
  "95": ["val d oise"],
};

export function locate(rawText: string): Localisation {
  const text = normalize(rawText);
  const padded = ` ${text} `;

  // 1. Code postal : le plus fiable.
  for (const match of rawText.matchAll(/\b(\d{5})\b/g)) {
    const cp = match[1];
    const commune = BY_POSTCODE.get(cp);
    if (commune) return { kind: "commune", commune, via: "code_postal", matched: cp };
    if (/^(0[1-9]|[1-8]\d|9[0-5]|97)\d{3}$/.test(cp) && !/^(7[578]|9[1-5])/.test(cp)) {
      return { kind: "hors_idf", matched: cp };
    }
  }

  // 2. Paris avec arrondissement (« Paris 11e », « 11ème arrondissement »).
  const arr = text.match(/\b(?:paris\s+)?(\d{1,2})\s*(?:e|eme|er)(?:\s+arrondissement)?\b/);
  if (arr && (text.includes("paris") || text.includes("arrondissement")) && Number(arr[1]) <= 20) {
    return { kind: "commune", commune: PARIS, via: "nom", matched: arr[0] };
  }

  // 3. Nom de commune.
  for (const { key, commune } of BY_NAME) {
    if (padded.includes(` ${key} `)) return { kind: "commune", commune, via: "nom", matched: key };
  }

  // 4. Département seul (nom, ou numéro dans une tournure explicite : « dans le 94 », « (93) »).
  for (const [code, names] of Object.entries(DEPARTEMENT_NAMES)) {
    const name = names.find((n) => padded.includes(` ${n} `));
    if (name) return { kind: "departement", departement: code, matched: name };
  }
  const deptNumber = rawText.match(/(?:\bdans le|\bdu|\ble|\()\s*(75|77|78|91|92|93|94|95)\b\)?/i);
  if (deptNumber) return { kind: "departement", departement: deptNumber[1], matched: deptNumber[0] };

  return { kind: "inconnue" };
}

/** Distance à vol d'oiseau en kilomètres. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function findCommune(nom: string): Commune | undefined {
  const key = normalize(nom);
  return COMMUNES.find((c) => normalize(c.nom) === key);
}
