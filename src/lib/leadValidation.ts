// Validation du formulaire de demande d'intervention, partagée entre le
// navigateur (messages immédiats) et l'API /api/lead (seule source de vérité).

import { siteConfig } from "@/data/site-config";

export type LeadFields = {
  nom: string;
  telephone: string;
  ville: string;
  probleme: string;
  message: string;
};

export type LeadErrors = Partial<Record<keyof LeadFields, string>>;

export const AUTRE_PROBLEME = "Autre";

export const PROBLEME_OPTIONS = [...siteConfig.problemes.map((p) => p.label), AUTRE_PROBLEME];

export const LIMITS = { nom: 80, telephone: 25, ville: 80, message: 1000 } as const;

/** Numéro français (fixe ou mobile), format national ou +33 / 0033. */
export function normalizeFrenchPhone(raw: string): string | null {
  const digits = raw.replace(/[\s.\-()]/g, "");
  const national = digits.replace(/^(\+33|0033)/, "0");
  return /^0[1-9]\d{8}$/.test(national) ? national : null;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateLead(input: Record<string, unknown>): {
  fields: LeadFields;
  errors: LeadErrors;
} {
  const fields: LeadFields = {
    nom: clean(input.nom),
    telephone: clean(input.telephone),
    ville: clean(input.ville),
    probleme: clean(input.probleme),
    message: clean(input.message),
  };
  const errors: LeadErrors = {};

  if (fields.nom.length < 2) errors.nom = "Indiquez votre nom.";
  else if (fields.nom.length > LIMITS.nom) errors.nom = "Nom trop long.";

  const phone = normalizeFrenchPhone(fields.telephone);
  if (!fields.telephone) errors.telephone = "Indiquez un numéro pour être rappelé.";
  else if (!phone) errors.telephone = "Numéro invalide. Exemple : 06 12 34 56 78.";
  else fields.telephone = phone;

  if (fields.ville.length < 2) errors.ville = "Indiquez votre ville ou votre code postal.";
  else if (fields.ville.length > LIMITS.ville) errors.ville = "Ville trop longue.";

  if (!PROBLEME_OPTIONS.includes(fields.probleme)) errors.probleme = "Choisissez le type de problème.";

  if (fields.message.length > LIMITS.message) {
    errors.message = `Description trop longue (${LIMITS.message} caractères maximum).`;
  }

  return { fields, errors };
}
