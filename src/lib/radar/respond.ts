// Réponses proposées et décision d'action.
// Règles : la réponse identifie toujours l'entreprise, propose le numéro
// professionnel, ne promet ni prix, ni délai, ni disponibilité. Aucune
// publication automatique sans que TOUTES les conditions de `decideAction`
// soient réunies ; aucun message privé promotionnel.

import { assertValidPhone, type RadarConfig } from "./config";
import type { Qualification } from "./qualify";
import { serviceLabel } from "./services";
import type { RadarMode, SourceDescriptor } from "./sources";
import { fingerprint } from "./text";

export type SourceSettings = {
  /** Mode choisi dans l'administration. Défaut : surveillance. */
  mode: RadarMode;
  /** Date de la vérification humaine des conditions de la source (activation explicite). */
  conditionsVerifieesLe: string | null;
  /** Date du dernier test de publication réussi. */
  testReussiLe: string | null;
  /** Source suspendue d'urgence. */
  suspendue: boolean;
};

export const DEFAULT_SOURCE_SETTINGS: SourceSettings = {
  mode: "surveillance",
  conditionsVerifieesLe: null,
  testReussiLe: null,
  suspendue: false,
};

export type Decision =
  | { action: "aucune"; raisons: string[] }
  | { action: "preparer"; raisons: string[] }
  | { action: "publier"; raisons: string[] };

const REPLYABLE = new Set(["CRITIQUE", "HAUTE", "NORMALE"]);

export function decideAction(
  q: Qualification,
  source: SourceDescriptor,
  settings: SourceSettings,
  env: Record<string, string | undefined>
): Decision {
  if (settings.suspendue) return { action: "aucune", raisons: ["source suspendue"] };
  if (!REPLYABLE.has(q.categorie)) return { action: "aucune", raisons: [`catégorie ${q.categorie}`] };
  if (settings.mode === "surveillance") return { action: "aucune", raisons: ["mode surveillance : détection seulement"] };
  if (!source.reponsePublique.automatiseeAutorisee && !source.reponsePublique.manuellePossible) {
    return { action: "aucune", raisons: ["aucune réponse possible sur cette source"] };
  }

  if (settings.mode === "automatique") {
    const bloquants: string[] = [];
    if (!source.reponsePublique.automatiseeAutorisee) bloquants.push("la source n'autorise pas les réponses automatisées");
    if (!settings.conditionsVerifieesLe) bloquants.push("conditions de la source non vérifiées dans l'administration");
    if (!settings.testReussiLe) bloquants.push("aucun test de publication réussi");
    const manquants = source.identifiants.filter((name) => !env[name]);
    if (manquants.length > 0) bloquants.push(`identifiants manquants : ${manquants.join(", ")}`);
    if (bloquants.length === 0) return { action: "publier", raisons: ["toutes les conditions de publication automatique sont réunies"] };
    if (source.reponsePublique.manuellePossible) {
      return { action: "preparer", raisons: ["publication automatique refusée, validation humaine requise", ...bloquants] };
    }
    return { action: "aucune", raisons: bloquants };
  }

  return { action: "preparer", raisons: ["mode assisté : réponse préparée, à valider et publier à la main"] };
}

type Ctx = { lieu: string; besoin: string; phone: string; brand: string };

const URGENT_TEMPLATES: ((c: Ctx) => string)[] = [
  (c) =>
    `Bonjour, ${c.brand} intervient pour ce type de situation (${c.besoin.toLowerCase()})${c.lieu}. Appelez-nous au ${c.phone} : nous vous dirons tout de suite si une intervention est possible dans votre secteur.`,
  (c) =>
    `Bonjour, si vous avez toujours besoin d'un serrurier${c.lieu}, vous pouvez joindre ${c.brand} au ${c.phone}. Décrivez votre situation et nous vérifions ensemble si nous pouvons intervenir.`,
  (c) =>
    `Bonjour, ${c.brand} propose des dépannages de serrurerie en Île-de-France. Pour « ${c.besoin.toLowerCase()} »${c.lieu}, le plus simple est de nous appeler au ${c.phone} pour vérifier la disponibilité.`,
];

const STANDARD_TEMPLATES: ((c: Ctx) => string)[] = [
  (c) =>
    `Bonjour, ${c.brand} réalise ce type de prestation (${c.besoin.toLowerCase()})${c.lieu}. Vous pouvez nous appeler au ${c.phone} pour expliquer votre besoin et obtenir un devis.`,
  (c) =>
    `Bonjour, pour votre projet (${c.besoin.toLowerCase()})${c.lieu}, ${c.brand} peut vous conseiller. Contactez-nous au ${c.phone} afin de préciser votre situation.`,
  (c) =>
    `Bonjour, ${c.brand} intervient en Île-de-France pour ce genre de demande. N'hésitez pas à nous joindre au ${c.phone} pour en parler et vérifier si nous couvrons votre adresse.`,
];

/**
 * Prépare une réponse adaptée à la demande. Le modèle varie selon la demande
 * (choix déterministe par empreinte) pour éviter des réponses identiques en série.
 */
export function generateResponse(q: Qualification, config: RadarConfig, seed: string): string {
  assertValidPhone(config);
  const lieu =
    q.localisation.kind === "commune"
      ? ` à ${q.localisation.commune.nom}`
      : q.localisation.kind === "departement"
        ? ` dans le ${q.localisation.departement}`
        : "";
  const ctx: Ctx = {
    lieu,
    besoin:
      q.servicePrincipal && q.servicePrincipal !== "serrurier_generique"
        ? serviceLabel(q.servicePrincipal)
        : "dépannage de serrurerie",
    phone: config.phoneDisplay,
    brand: config.brandName,
  };
  const urgent = q.urgence.explicite.length > 0 || q.urgence.parNature;
  const templates = urgent ? URGENT_TEMPLATES : STANDARD_TEMPLATES;
  const index = parseInt(fingerprint(seed), 16) % templates.length;
  return templates[index](ctx);
}
