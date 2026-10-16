// Configuration métier du Lead Radar.
// Ces valeurs par défaut reprennent uniquement des informations déjà présentes
// sur le site. Tout ce que l'entreprise n'a pas fourni (horaires, rayon) reste
// à `null` = « non renseigné » : le radar ne l'invente pas.

import { siteConfig } from "@/data/site-config";
import { findCommune } from "./geo";

export type ServiceId =
  | "porte_claquee"
  | "porte_bloquee"
  | "cle_cassee"
  | "cle_perdue"
  | "serrure_bloquee"
  | "ouverture_porte"
  | "changement_serrure"
  | "remplacement_cylindre"
  | "serrure_multipoints"
  | "securisation_porte"
  | "apres_effraction"
  | "installation_serrure"
  | "reparation_porte"
  | "devis_serrurier"
  | "serrurier_generique";

export type RadarConfig = {
  /** Numéro professionnel proposé dans les réponses. */
  phoneDisplay: string;
  brandName: string;
  siteUrl: string;
  /** Départements couverts (codes). */
  departements: string[];
  /** Départements prioritaires (sous-ensemble). Vide = tous équivalents. */
  departementsPrioritaires: string[];
  /** Point de départ des interventions (pour le rayon). */
  base: { nom: string; lat: number; lng: number } | null;
  /** Rayon d'intervention prioritaire en km. `null` = non renseigné, pas de pénalité. */
  rayonKm: number | null;
  /** Horaires d'intervention. `null` = non renseignés (aucune promesse de disponibilité). */
  horaires: string | null;
  /** Prestations réellement proposées. */
  services: ServiceId[];
  /** Au-delà, une publication est considérée comme ancienne (jours). */
  ancienneteMaxJours: number;
  /** Plomberie : catalogue séparé, désactivé comme source de prospects. */
  plomberie: {
    /** Si false : demandes détectées et comptées, jamais proposées ni notifiées. */
    prospectsActifs: boolean;
    /** Familles réellement assurées (confirmé : débouchage). */
    famillesProposees: ("debouchage" | "fuite" | "robinetterie_sanitaires")[];
    /** Zone annoncée par le projet « A l'eau Plombier 24 » (sans le 95). */
    departements: string[];
  };
};

/** Ancien numéro, à ne jamais proposer dans une réponse commerciale. */
export const FORBIDDEN_PHONE_DIGITS = "0754471250";

function departementsFromSite(): string[] {
  const codes = siteConfig.villes
    .map((v) => v.departement.match(/\d{2}/)?.[0])
    .filter((c): c is string => Boolean(c));
  return [...new Set(codes)].sort();
}

function baseFromLegalAddress() {
  const ville = siteConfig.legal.address.match(/\d{5}\s+([^,]+)/)?.[1];
  const commune = ville ? findCommune(ville.trim()) : undefined;
  return commune ? { nom: commune.nom, lat: commune.lat, lng: commune.lng } : null;
}

export function defaultRadarConfig(): RadarConfig {
  return {
    phoneDisplay: siteConfig.contact.phoneDisplay,
    brandName: siteConfig.brand.name,
    siteUrl: siteConfig.siteUrl,
    departements: departementsFromSite(),
    departementsPrioritaires: [],
    base: baseFromLegalAddress(),
    rayonKm: null,
    horaires: null,
    services: [
      "porte_claquee",
      "porte_bloquee",
      "cle_cassee",
      "cle_perdue",
      "serrure_bloquee",
      "ouverture_porte",
      "changement_serrure",
      "remplacement_cylindre",
      "serrure_multipoints",
      "securisation_porte",
      "apres_effraction",
      "installation_serrure",
      "reparation_porte",
      "devis_serrurier",
      "serrurier_generique",
    ],
    ancienneteMaxJours: 30,
    plomberie: {
      prospectsActifs: false,
      famillesProposees: ["debouchage"],
      departements: ["75", "77", "78", "91", "92", "93", "94"],
    },
  };
}

/** Lève une erreur si la configuration risque de publier un mauvais numéro. */
export function assertValidPhone(config: RadarConfig): void {
  const digits = config.phoneDisplay.replace(/\D/g, "");
  if (digits === FORBIDDEN_PHONE_DIGITS) {
    throw new Error("Le numéro 07 54 47 12 50 ne doit pas être utilisé dans les réponses du radar.");
  }
  if (!/^0[1-9]\d{8}$/.test(digits)) {
    throw new Error("Numéro professionnel du radar invalide.");
  }
}
