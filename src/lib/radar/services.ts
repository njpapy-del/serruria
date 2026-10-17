// Catalogue des besoins reconnus par le radar. Expressions en texte normalisé
// (sans accents, minuscules — voir text.ts).

import type { ServiceId } from "./config";
import { containsAny } from "./text";

type ServiceDef = {
  id: ServiceId;
  label: string;
  /** Situation urgente par nature (personne bloquée, porte non verrouillable…). */
  urgentParNature: boolean;
  phrases: string[];
};

export const SERVICES: ServiceDef[] = [
  {
    id: "porte_claquee",
    label: "Porte claquée",
    urgentParNature: true,
    phrases: [
      "porte claquee",
      "porte est claquee",
      "porte s est claquee",
      "porte qui a claque",
      "porte a claque",
      "claque la porte",
      "claque ma porte",
      "claque derriere moi",
      "porte s est refermee",
      "porte refermee",
      "cles a l interieur",
      "cle a l interieur",
      "cles oubliees a l interieur",
      "cle oubliee a l interieur",
      "oublie mes cles a l interieur",
      "oublie mes cles dedans",
      "cles restees a l interieur",
      "cles sont restees a l interieur",
    ],
  },
  {
    id: "porte_bloquee",
    label: "Porte bloquée",
    urgentParNature: true,
    phrases: [
      "porte bloquee",
      "porte est bloquee",
      "porte fermee a cle",
      "ferme a cle",
      "fermee a cle",
      "bloque dehors",
      "bloquee dehors",
      "enferme dehors",
      "enfermee dehors",
      "enferme a l exterieur",
      "enfermee a l exterieur",
      "bloque devant ma porte",
      "bloquee devant ma porte",
      "enferme a l interieur",
      "enfermee a l interieur",
      "porte ne s ouvre plus",
      "impossible d ouvrir ma porte",
      "impossible d ouvrir la porte",
      "porte impossible a ouvrir",
      "porte ne veut plus s ouvrir",
      "n arrive plus a ouvrir ma porte",
    ],
  },
  {
    id: "cle_cassee",
    label: "Clé cassée",
    urgentParNature: true,
    phrases: ["cle cassee", "cle est cassee", "cle s est cassee", "cle coincee", "cle est coincee", "cle s est coincee", "cle bloquee dans la serrure", "cle restee dans la serrure"],
  },
  {
    id: "cle_perdue",
    label: "Clé perdue",
    urgentParNature: true,
    phrases: ["cle perdue", "cles perdues", "perdu mes cles", "perdu ma cle", "perdu les cles", "vol de cles", "vole mes cles", "plus de cles"],
  },
  {
    id: "serrure_bloquee",
    label: "Serrure bloquée ou cassée",
    urgentParNature: true,
    phrases: [
      "serrure bloquee",
      "serrure est bloquee",
      "serrure coincee",
      "serrure qui bloque",
      "serrure ne tourne plus",
      "cylindre bloque",
      "serrure cassee",
      "serrure est cassee",
      "serrure endommagee",
      "serrure abimee",
      "serrure forcee",
    ],
  },
  {
    id: "ouverture_porte",
    label: "Ouverture de porte",
    urgentParNature: true,
    phrases: ["ouverture de porte", "ouvrir ma porte", "ouvrir la porte", "ouvrir une porte"],
  },
  {
    id: "apres_effraction",
    label: "Mise en sécurité après effraction",
    urgentParNature: true,
    phrases: ["effraction", "cambriolage", "cambriole", "cambriolee", "porte fracturee", "tentative d effraction", "serrure forcee"],
  },
  {
    id: "changement_serrure",
    label: "Changement de serrure",
    urgentParNature: false,
    phrases: ["changement de serrure", "changer la serrure", "changer ma serrure", "changer de serrure", "remplacer la serrure", "remplacement de serrure", "remplacer ma serrure"],
  },
  {
    id: "remplacement_cylindre",
    label: "Remplacement de cylindre",
    urgentParNature: false,
    phrases: ["cylindre", "barillet"],
  },
  {
    id: "serrure_multipoints",
    label: "Serrure multipoints",
    urgentParNature: false,
    phrases: ["multipoints", "multipoint", "serrure 3 points", "serrure 5 points"],
  },
  {
    id: "securisation_porte",
    label: "Sécurisation de porte",
    urgentParNature: false,
    phrases: ["securiser ma porte", "securisation de porte", "blindage", "porte blindee", "renforcer ma porte", "serrure a2p"],
  },
  {
    id: "installation_serrure",
    label: "Installation de serrure",
    urgentParNature: false,
    phrases: ["installer une serrure", "installation de serrure", "pose de serrure", "poser une serrure", "ajouter une serrure"],
  },
  {
    id: "reparation_porte",
    label: "Réparation de porte",
    urgentParNature: false,
    phrases: ["reparation de porte", "reparer ma porte", "reparer la porte", "porte abimee", "porte qui ferme mal", "porte ne ferme plus"],
  },
  {
    id: "devis_serrurier",
    label: "Devis serrurier",
    urgentParNature: false,
    phrases: ["devis serrurier", "devis serrurerie", "devis pour une serrure", "devis pour changer"],
  },
  {
    id: "serrurier_generique",
    label: "Besoin de serrurier (non précisé)",
    urgentParNature: false,
    phrases: ["serrurier", "serruriers", "serrurerie"],
  },
];

/** Mots d'urgence explicite (en plus des situations urgentes par nature). */
export const URGENCY_PHRASES = [
  "urgence",
  "urgent",
  "urgemment",
  "en urgence",
  "au plus vite",
  "rapidement",
  "maintenant",
  "tout de suite",
  "immediatement",
  "ce soir",
  "cette nuit",
  "la nuit",
  "de nuit",
  "aujourd hui",
  "dimanche",
  "jour ferie",
  "sos",
  "help",
  "a l aide",
  "bebe a l interieur",
  "enfant a l interieur",
  "gaz allume",
  "feu allume",
];

export type ServiceMatch = { id: ServiceId; label: string; urgentParNature: boolean; matched: string[] };

// ── Plomberie : catalogue DISTINCT ───────────────────────────────────────────
// Activité non proposée comme prospect à ce jour (décision du 2026-10-16) : les
// demandes sont détectées et comptées, jamais présentées comme exploitables.
// Seul le débouchage est confirmé comme prestation assurée.

export type PlumbingServiceId =
  | "debouchage_wc"
  | "debouchage_evier_lavabo"
  | "debouchage_canalisation"
  | "fuite_eau"
  | "degat_des_eaux"
  | "robinetterie"
  | "chasse_eau"
  | "plombier_generique";

export type PlumbingFamily = "debouchage" | "fuite" | "robinetterie_sanitaires" | "generique";

type PlumbingDef = { id: PlumbingServiceId; label: string; famille: PlumbingFamily; urgentParNature: boolean; phrases: string[] };

export const PLUMBING_SERVICES: PlumbingDef[] = [
  {
    id: "debouchage_wc",
    label: "WC bouché",
    famille: "debouchage",
    urgentParNature: true,
    phrases: ["wc bouche", "wc bouches", "wc est bouche", "wc sont bouches", "toilettes sont bouchees", "toilette est bouchee", "l eau deborde", "toilettes bouchees", "toilette bouchee", "toilettes qui debordent", "wc qui deborde", "debouchage wc", "deboucher les toilettes", "deboucher mes toilettes"],
  },
  {
    id: "debouchage_evier_lavabo",
    label: "Évier ou lavabo bouché",
    famille: "debouchage",
    urgentParNature: false,
    phrases: ["evier bouche", "evier est bouche", "lavabo bouche", "lavabo est bouche", "douche bouchee", "baignoire bouchee", "siphon bouche", "deboucher l evier", "deboucher mon evier", "eau ne s evacue plus", "l eau ne s ecoule plus"],
  },
  {
    id: "debouchage_canalisation",
    label: "Canalisation bouchée",
    famille: "debouchage",
    urgentParNature: true,
    phrases: ["canalisation bouchee", "canalisation est bouchee", "canalisations bouchees", "canalisations sont bouchees", "tuyau bouche", "evacuation bouchee", "debouchage canalisation", "deboucher une canalisation", "remontee d eaux usees"],
  },
  {
    id: "fuite_eau",
    label: "Fuite d'eau",
    famille: "fuite",
    urgentParNature: true,
    phrases: ["fuite d eau", "fuite sur canalisation", "fuite de canalisation", "tuyau eclate", "tuyau perce", "canalisation percee", "fuite sous l evier", "fuite au plafond", "ca fuit"],
  },
  {
    id: "degat_des_eaux",
    label: "Dégât des eaux",
    famille: "fuite",
    urgentParNature: true,
    phrases: ["degat des eaux", "degats des eaux", "inondation chez moi", "appartement inonde", "infiltration d eau"],
  },
  {
    id: "robinetterie",
    label: "Robinet cassé",
    famille: "robinetterie_sanitaires",
    urgentParNature: false,
    phrases: ["robinet casse", "robinet est casse", "robinet qui fuit", "robinet bloque", "changer un robinet", "remplacer le robinet", "mitigeur"],
  },
  {
    id: "chasse_eau",
    label: "Chasse d'eau défectueuse",
    famille: "robinetterie_sanitaires",
    urgentParNature: false,
    phrases: ["chasse d eau", "chasse qui coule", "chasse d eau qui fuit", "mecanisme de chasse"],
  },
  {
    id: "plombier_generique",
    label: "Besoin de plombier (non précisé)",
    famille: "generique",
    urgentParNature: false,
    phrases: ["plombier", "plombiers", "plomberie"],
  },
];

export type PlumbingMatch = { id: PlumbingServiceId; label: string; famille: PlumbingFamily; urgentParNature: boolean; matched: string[] };

export function detectPlumbing(normalizedText: string): PlumbingMatch[] {
  const matches = PLUMBING_SERVICES.map((s) => ({
    id: s.id,
    label: s.label,
    famille: s.famille,
    urgentParNature: s.urgentParNature,
    matched: containsAny(normalizedText, s.phrases),
  })).filter((m) => m.matched.length > 0);
  const precise = matches.filter((m) => m.id !== "plombier_generique");
  return precise.length > 0 ? precise : matches;
}

/** Besoins détectés, du plus précis au plus générique. */
export function detectServices(normalizedText: string): ServiceMatch[] {
  const matches = SERVICES.map((s) => ({
    id: s.id,
    label: s.label,
    urgentParNature: s.urgentParNature,
    matched: containsAny(normalizedText, s.phrases),
  })).filter((m) => m.matched.length > 0);

  // « serrurier » seul n'est utile que si aucun besoin précis n'a été trouvé.
  const precise = matches.filter((m) => m.id !== "serrurier_generique");
  return precise.length > 0 ? precise : matches;
}

export function detectUrgency(normalizedText: string): string[] {
  return containsAny(normalizedText, URGENCY_PHRASES);
}

export function serviceLabel(id: ServiceId): string {
  return SERVICES.find((s) => s.id === id)?.label ?? id;
}
