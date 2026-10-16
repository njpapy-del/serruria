// Qualification explicable d'un contenu détecté.
// Le score (0-100) classe les opportunités entre elles. Ce n'est PAS une
// probabilité de conversion.

import type { RadarConfig, ServiceId } from "./config";
import { distanceKm, locate, type Localisation } from "./geo";
import { detectServices, detectUrgency, type ServiceMatch } from "./services";
import { containsAny, normalize } from "./text";
import type { SourceDescriptor } from "./sources";

export type ContentKind = "demande" | "annonce_pro" | "article" | "annuaire" | "incertain";

export type Categorie =
  | "CRITIQUE"
  | "HAUTE"
  | "NORMALE"
  | "HORS_ZONE"
  | "NON_PERTINENT"
  | "DOUBLON"
  | "A_VERIFIER";

export type RawItem = {
  sourceId: string;
  /** Identifiant fourni par la source (guid RSS, id API…). */
  externalId: string | null;
  url: string | null;
  title: string;
  content: string;
  publishedAt: Date | null;
};

/** Classe commerciale demandée par l'entreprise (indépendante du score). */
export type ClasseCommerciale =
  | "DEMANDE_CONFIRMEE"
  | "DEMANDE_PROBABLE"
  | "DEMANDE_ANCIENNE"
  | "CONTENU_INFORMATIF"
  | "ANNUAIRE"
  | "CONCURRENT_PUBLICITE"
  | "NON_PERTINENT"
  | "HORS_IDF"
  | "INACCESSIBLE"
  | "A_VERIFIER";

export type ScoreLine = { critere: string; points: number; max: number; raison: string };

export type Qualification = {
  kind: ContentKind;
  kindReasons: string[];
  services: ServiceMatch[];
  servicePrincipal: ServiceId | null;
  urgence: { explicite: string[]; parNature: boolean };
  localisation: Localisation;
  distanceKm: number | null;
  ageHeures: number | null;
  score: number;
  lignes: ScoreLine[];
  categorie: Categorie;
  categorieRaison: string;
  classe: ClasseCommerciale;
  urgente: boolean;
};

// Une personne qui demande de l'aide (première personne, question, sollicitation).
const DEMAND_PHRASES = [
  "je cherche",
  "je recherche",
  "recherche un serrurier",
  "recherche serrurier",
  "cherche un serrurier",
  "cherche serrurier",
  "besoin d un serrurier",
  "besoin serrurier",
  "j ai besoin",
  "quelqu un connait",
  "quelqu un connaitrait",
  "vous connaissez",
  "vous auriez",
  "auriez vous",
  "pouvez vous me recommander",
  "une recommandation",
  "des recommandations",
  "un bon serrurier",
  "serrurier fiable",
  "serrurier de confiance",
  "je suis bloque",
  "je suis bloquee",
  "je suis enferme",
  "je suis enfermee",
  "ma porte",
  "mes cles",
  "ma cle",
  "ma serrure",
  "chez moi",
  "aidez moi",
  "svp",
  "s il vous plait",
  "merci d avance",
];

// Formulations qui expriment sans ambiguïté qu'une personne cherche un serrurier.
const STRONG_DEMAND_PHRASES = [
  "je cherche",
  "je recherche",
  "recherche un serrurier",
  "recherche serrurier",
  "cherche un serrurier",
  "cherche serrurier",
  "besoin d un serrurier",
  "besoin serrurier",
  "j ai besoin",
  "quelqu un connait",
  "quelqu un connaitrait",
  "vous connaissez",
  "pouvez vous me recommander",
  "je suis bloque",
  "je suis bloquee",
  "je suis enferme",
  "je suis enfermee",
  "aidez moi",
];

// Communication d'un professionnel (publicité, concurrent).
const PRO_AD_PHRASES = [
  "nos serruriers",
  "notre equipe",
  "nos techniciens",
  "devis gratuit",
  "intervention en 30 min",
  "intervention en 20 min",
  "intervention rapide garantie",
  "24h 24",
  "24 24",
  "7j 7",
  "appelez nous",
  "appelez le",
  "contactez nous",
  "nos tarifs",
  "tarifs",
  "agree assurances",
  "sans engagement",
  "serrurier professionnel",
  "je travaille sur",
  "je travail sur",
  "dernier avis",
  "nos prestations",
  "ses prestations",
  "extraction tarif",
  "tarif extraction",
  "intervention rapide",
  "depannage d urgence 24",
];

const ARTICLE_PHRASES = [
  "selon",
  "a ete condamne",
  "arnaque",
  "arnaques",
  "escroquerie",
  "enquete",
  "faits divers",
  "a ete interpelle",
  "tribunal",
  "comment choisir",
  "guide",
  "conseils pour",
  "prix moyen",
  "combien coute",
  "astuce",
  "astuces",
  "les bons gestes",
  "bons gestes",
  "les bons reflexes",
  "que faire",
  "comment ouvrir",
  "comment enlever",
  "comment rentrer",
  "comment gerer",
  "techniques",
  "ce geste",
  "conseils",
  "grille de prix",
  "prise en charge",
  "qui doit payer",
  "avocat",
  "blog",
];

const DIRECTORY_PHRASES = ["annuaire", "top 10", "meilleurs serruriers", "classement", "liste des serruriers", "comparatif"];

// Annuaires et plateformes de mise en relation : listes de professionnels, pas
// des demandes de clients (constaté en réel sur Brave le 2026-10-16).
const DIRECTORY_HOSTS = [
  "pagesjaunes.fr",
  "yelp.",
  "travaux.com",
  "habitatpresto.com",
  "starofservice",
  "mappy.",
  "118712",
  "118000",
  "societe.com",
  "allovoisins.com",
  "ou-serrurier.fr",
  "fairfair.com",
  "lesbonsartisans.fr",
  "allo-reparateurs.fr",
  "depanneo.com",
  "mesdepanneurs.fr",
  "metallerie-serrurerie.net",
];

function classifyKind(text: string, url: string | null): { kind: ContentKind; reasons: string[] } {
  const demand = containsAny(text, DEMAND_PHRASES);
  const pro = containsAny(text, PRO_AD_PHRASES);
  const article = containsAny(text, ARTICLE_PHRASES);
  const directory = containsAny(text, DIRECTORY_PHRASES);
  const host = url ? safeHost(url) : "";
  const directoryHost = DIRECTORY_HOSTS.find((h) => host.includes(h));

  if (directoryHost) return { kind: "annuaire", reasons: [`site d'annuaire ou de mise en relation (${directoryHost})`] };
  if (directory.length > 0 && demand.length === 0) return { kind: "annuaire", reasons: directory.map((d) => `« ${d} »`) };
  if (pro.length >= 2 || (pro.length === 1 && demand.length === 0)) {
    return { kind: "annonce_pro", reasons: pro.map((p) => `« ${p} »`) };
  }
  if (article.length > 0 && demand.length === 0) return { kind: "article", reasons: article.map((a) => `« ${a} »`) };
  if (demand.length > 0) return { kind: "demande", reasons: demand.map((d) => `« ${d} »`) };
  return { kind: "incertain", reasons: ["aucune formulation de demande reconnue"] };
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function qualify(item: RawItem, source: SourceDescriptor, config: RadarConfig, now: Date): Qualification {
  const text = normalize(`${item.title} ${item.content}`);
  const { kind, reasons: kindReasons } = classifyKind(text, item.url);
  const services = detectServices(text).filter((s) => config.services.includes(s.id));
  const servicePrincipal = services[0]?.id ?? null;
  const urgenceExplicite = detectUrgency(text);
  const urgentParNature = services.some((s) => s.urgentParNature);
  const localisation = locate(`${item.title} ${item.content}`);
  const ageHeures = item.publishedAt ? Math.max(0, (now.getTime() - item.publishedAt.getTime()) / 3_600_000) : null;

  let distance: number | null = null;
  if (localisation.kind === "commune" && config.base) distance = distanceKm(config.base, localisation.commune);

  const lignes: ScoreLine[] = [];

  // Urgence (30)
  if (urgenceExplicite.length > 0) {
    lignes.push({ critere: "Urgence", points: 30, max: 30, raison: `urgence explicite : ${urgenceExplicite.join(", ")}` });
  } else if (urgentParNature) {
    lignes.push({ critere: "Urgence", points: 20, max: 30, raison: "situation urgente par nature, sans mot d'urgence" });
  } else {
    lignes.push({ critere: "Urgence", points: 0, max: 30, raison: "aucune urgence exprimée" });
  }

  // Localisation (25)
  const dept =
    localisation.kind === "commune" ? localisation.commune.departement : localisation.kind === "departement" ? localisation.departement : null;
  const inZone = dept !== null && config.departements.includes(dept);
  if (localisation.kind === "commune" && inZone) {
    const horsRayon = config.rayonKm !== null && distance !== null && distance > config.rayonKm;
    const points = horsRayon ? 15 : 25;
    const detail = distance !== null && config.base ? ` — ${Math.round(distance)} km de ${config.base.nom}` : "";
    lignes.push({
      critere: "Localisation",
      points,
      max: 25,
      raison: `${localisation.commune.nom} (${dept})${detail}${horsRayon ? " — au-delà du rayon prioritaire" : ""}`,
    });
  } else if (localisation.kind === "departement" && inZone) {
    lignes.push({ critere: "Localisation", points: 12, max: 25, raison: `département ${dept} seulement, commune inconnue` });
  } else if (dept !== null || localisation.kind === "hors_idf") {
    lignes.push({ critere: "Localisation", points: 0, max: 25, raison: "hors des départements couverts" });
  } else {
    lignes.push({ critere: "Localisation", points: 0, max: 25, raison: "localisation inconnue" });
  }

  // Prestation (20)
  if (servicePrincipal && servicePrincipal !== "serrurier_generique") {
    lignes.push({ critere: "Prestation", points: 20, max: 20, raison: services.map((s) => s.label).join(", ") });
  } else if (servicePrincipal === "serrurier_generique") {
    lignes.push({ critere: "Prestation", points: 10, max: 20, raison: "besoin de serrurier non précisé" });
  } else {
    lignes.push({ critere: "Prestation", points: 0, max: 20, raison: "aucune prestation proposée reconnue" });
  }

  // Récence (15)
  if (ageHeures === null) {
    lignes.push({ critere: "Récence", points: 0, max: 15, raison: "date de publication inconnue" });
  } else {
    const points = ageHeures <= 2 ? 15 : ageHeures <= 24 ? 12 : ageHeures <= 72 ? 8 : ageHeures <= 24 * 7 ? 4 : 0;
    lignes.push({ critere: "Récence", points, max: 15, raison: `publiée il y a ${formatAge(ageHeures)}` });
  }

  // Compatibilité de la source (10) : une réponse est-elle possible, même manuelle ?
  if (source.reponsePublique.automatiseeAutorisee) {
    lignes.push({ critere: "Source", points: 10, max: 10, raison: "réponse automatisée autorisée par la source" });
  } else if (source.reponsePublique.manuellePossible) {
    lignes.push({ critere: "Source", points: 5, max: 10, raison: "réponse possible uniquement à la main" });
  } else {
    lignes.push({ critere: "Source", points: 0, max: 10, raison: "aucune réponse possible sur cette source" });
  }

  const score = lignes.reduce((sum, l) => sum + l.points, 0);
  const urgente = urgenceExplicite.length > 0 || urgentParNature;
  const { categorie, raison } = categorize({ kind, services, localisation, inZone, ageHeures, score, urgence: urgente, config });
  const classe = classify({
    kind,
    categorie,
    hasService: services.length > 0,
    strongDemand: containsAny(text, STRONG_DEMAND_PHRASES).length > 0,
    localisation,
    trop_ancienne: ageHeures !== null && ageHeures > config.ancienneteMaxJours * 24,
  });

  return {
    kind,
    kindReasons,
    services,
    servicePrincipal,
    urgence: { explicite: urgenceExplicite, parNature: urgentParNature },
    localisation,
    distanceKm: distance,
    ageHeures,
    score,
    lignes,
    categorie,
    categorieRaison: raison,
    classe,
    urgente,
  };
}

function classify(p: {
  kind: ContentKind;
  categorie: Categorie;
  hasService: boolean;
  strongDemand: boolean;
  localisation: Localisation;
  trop_ancienne: boolean;
}): ClasseCommerciale {
  if (p.kind === "annonce_pro") return "CONCURRENT_PUBLICITE";
  if (p.kind === "annuaire") return "ANNUAIRE";
  if (p.kind === "article") return "CONTENU_INFORMATIF";
  if (!p.hasService) return "NON_PERTINENT";
  if (p.trop_ancienne) return p.kind === "demande" ? "DEMANDE_ANCIENNE" : "NON_PERTINENT";
  if (p.categorie === "HORS_ZONE") return "HORS_IDF";
  if (p.kind !== "demande" || p.localisation.kind === "inconnue") return "A_VERIFIER";
  // « Confirmée » = formulation explicite de demande + commune identifiée.
  // Cela reste une lecture du texte : un humain doit toujours vérifier.
  if (p.strongDemand && p.localisation.kind === "commune") return "DEMANDE_CONFIRMEE";
  return "DEMANDE_PROBABLE";
}

function categorize(p: {
  kind: ContentKind;
  services: ServiceMatch[];
  localisation: Localisation;
  inZone: boolean;
  ageHeures: number | null;
  score: number;
  urgence: boolean;
  config: RadarConfig;
}): { categorie: Categorie; raison: string } {
  if (p.kind === "annonce_pro") return { categorie: "NON_PERTINENT", raison: "publicité d'un professionnel" };
  if (p.kind === "article") return { categorie: "NON_PERTINENT", raison: "article ou contenu informatif" };
  if (p.kind === "annuaire") return { categorie: "NON_PERTINENT", raison: "annuaire ou plateforme de mise en relation" };
  if (p.services.length === 0) return { categorie: "NON_PERTINENT", raison: "aucun besoin de serrurerie reconnu" };
  if (p.ageHeures !== null && p.ageHeures > p.config.ancienneteMaxJours * 24) {
    return { categorie: "NON_PERTINENT", raison: `publication de plus de ${p.config.ancienneteMaxJours} jours` };
  }
  if (p.localisation.kind === "hors_idf" || (p.localisation.kind !== "inconnue" && !p.inZone)) {
    return { categorie: "HORS_ZONE", raison: "en dehors des départements couverts" };
  }
  if (p.kind === "incertain") return { categorie: "A_VERIFIER", raison: "impossible d'affirmer qu'il s'agit d'une vraie demande" };
  if (p.localisation.kind === "inconnue") return { categorie: "A_VERIFIER", raison: "localisation inconnue" };
  if (p.score >= 75 && p.urgence) return { categorie: "CRITIQUE", raison: "demande urgente, récente et dans la zone" };
  if (p.score >= 55) return { categorie: "HAUTE", raison: "demande pertinente dans la zone" };
  return { categorie: "NORMALE", raison: "demande dans la zone, peu urgente ou ancienne" };
}

function formatAge(heures: number): string {
  if (heures < 1) return `${Math.round(heures * 60)} min`;
  if (heures < 48) return `${Math.round(heures)} h`;
  return `${Math.round(heures / 24)} jours`;
}
