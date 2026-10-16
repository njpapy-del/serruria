// Registre des sources du Lead Radar.
// Chaque source déclare EXPLICITEMENT ce qu'elle permet. Une source n'est
// jamais publiable automatiquement par défaut : voir `decideAction` (respond.ts).
// Les informations de conditions d'utilisation ont été vérifiées le 2026-10-16
// à partir des pages citées dans `references` ; elles doivent être revérifiées
// avant toute activation.

export type AccessMode = "api" | "webhook" | "rss" | "email" | "csv" | "manuel" | "aucun";
export type RadarMode = "surveillance" | "assiste" | "automatique";
export type SourceStatus = "disponible" | "sous_conditions" | "non_configuree" | "ecartee";

export type SourceDescriptor = {
  id: string;
  nom: string;
  description: string;
  acces: AccessMode;
  statut: SourceStatus;
  /** Ce que le connecteur lit. */
  lit: string[];
  /** Réponse publique possible sur la source (commentaire sous la demande). */
  reponsePublique: {
    /** Les conditions de la source autorisent-elles une réponse commerciale automatisée ? */
    automatiseeAutorisee: boolean;
    /** Une réponse manuelle par l'entreprise est-elle possible (hors du radar) ? */
    manuellePossible: boolean;
    note: string;
  };
  /** Message privé promotionnel : jamais sans consentement (art. L34-5 CPCE). */
  messagePriveAutorise: false;
  prerequis: string[];
  /** Variables d'environnement requises (noms uniquement). */
  identifiants: string[];
  frequenceMinMinutes: number | null;
  cout: string;
  references: string[];
  verifieLe: string;
};

export const SOURCES: SourceDescriptor[] = [
  {
    id: "site_form",
    nom: "Formulaire du site",
    description: "Demandes d'intervention envoyées via serrurerielouisfils.com (déjà en place).",
    acces: "api",
    statut: "disponible",
    lit: ["nom", "téléphone", "ville ou code postal", "type de problème", "description"],
    reponsePublique: {
      automatiseeAutorisee: false,
      manuellePossible: true,
      note: "Le client a demandé à être rappelé : on le rappelle, aucune publication.",
    },
    messagePriveAutorise: false,
    prerequis: [],
    identifiants: [],
    frequenceMinMinutes: null,
    cout: "0 €",
    references: [],
    verifieLe: "2026-10-16",
  },
  {
    id: "alertes_rss",
    nom: "Alertes web (flux RSS)",
    description:
      "Flux RSS d'alertes de veille créés par l'entreprise (Google Alerts « Envoyer à : flux RSS », Talkwalker Alerts). Signale de nouvelles pages publiques indexées contenant les mots surveillés.",
    acces: "rss",
    statut: "non_configuree",
    lit: ["titre", "extrait", "URL", "date de publication"],
    reponsePublique: {
      automatiseeAutorisee: false,
      manuellePossible: true,
      note: "Le flux ne donne aucun droit de publier sur les pages trouvées. Réponse éventuelle uniquement à la main, selon les règles du site d'origine.",
    },
    messagePriveAutorise: false,
    prerequis: ["Créer les alertes dans le compte Google de l'entreprise, livraison « Flux RSS »", "Renseigner les URL des flux"],
    identifiants: ["RADAR_RSS_FEEDS"],
    frequenceMinMinutes: 30,
    cout: "0 €",
    references: ["https://www.google.com/alerts", "https://www.talkwalker.com/alerts"],
    verifieLe: "2026-10-16",
  },
  {
    id: "google_ads_lead_form",
    nom: "Formulaires de leads Google Ads (webhook)",
    description: "Leads saisis dans un élément « formulaire pour prospects » des annonces, envoyés par webhook officiel.",
    acces: "webhook",
    statut: "sous_conditions",
    lit: ["champs du formulaire choisis dans Google Ads"],
    reponsePublique: { automatiseeAutorisee: false, manuellePossible: true, note: "Lead entrant : rappel du client." },
    messagePriveAutorise: false,
    prerequis: ["Utiliser un formulaire pour prospects dans Google Ads (non modifié par le radar)", "Clé de webhook partagée"],
    identifiants: ["GOOGLE_ADS_WEBHOOK_KEY"],
    frequenceMinMinutes: null,
    cout: "Inclus dans la dépense Google Ads",
    references: ["https://developers.google.com/google-ads/webhook/docs/overview"],
    verifieLe: "2026-10-16",
  },
  {
    id: "brave_search",
    nom: "Brave Search API",
    description: "API de recherche web officielle et payante : demandes publiques non urgentes (indexation avec retard).",
    acces: "api",
    statut: "sous_conditions",
    lit: ["titre", "extrait", "URL", "âge de la page"],
    reponsePublique: {
      automatiseeAutorisee: false,
      manuellePossible: true,
      note: "Moteur de recherche : aucun droit de publier sur les pages trouvées.",
    },
    messagePriveAutorise: false,
    prerequis: ["Compte Brave Search API", "Clé API"],
    identifiants: ["BRAVE_SEARCH_API_KEY"],
    frequenceMinMinutes: 60,
    cout: "Payant à l'usage (voir brave.com/search/api)",
    references: ["https://brave.com/search/api/"],
    verifieLe: "2026-10-16",
  },
  {
    id: "csv_import",
    nom: "Import CSV",
    description: "Import manuel de demandes obtenues légitimement (plateforme partenaire, export).",
    acces: "csv",
    statut: "disponible",
    lit: ["colonnes validées"],
    reponsePublique: { automatiseeAutorisee: false, manuellePossible: true, note: "Selon la provenance documentée." },
    messagePriveAutorise: false,
    prerequis: ["Provenance et base légale documentées pour chaque fichier"],
    identifiants: [],
    frequenceMinMinutes: null,
    cout: "0 €",
    references: [],
    verifieLe: "2026-10-16",
  },
  // ── Sources étudiées et écartées : documentées pour ne pas y revenir sans raison.
  {
    id: "google_search_scraping",
    nom: "Résultats Google (extraction)",
    description: "Extraction automatique des pages de résultats Google.",
    acces: "aucun",
    statut: "ecartee",
    lit: [],
    reponsePublique: { automatiseeAutorisee: false, manuellePossible: false, note: "Extraction interdite par les conditions Google. L'API Custom Search est fermée aux nouveaux clients et s'arrête le 2027-01-01." },
    messagePriveAutorise: false,
    prerequis: [],
    identifiants: [],
    frequenceMinMinutes: null,
    cout: "—",
    references: ["https://brave.com/fr/learn/google-api-shutdown/"],
    verifieLe: "2026-10-16",
  },
  {
    id: "facebook_groups",
    nom: "Groupes Facebook",
    description: "Groupes de quartier / entraide.",
    acces: "aucun",
    statut: "ecartee",
    lit: [],
    reponsePublique: { automatiseeAutorisee: false, manuellePossible: true, note: "API des groupes supprimée par Meta (v19, avril 2024). Réponse manuelle seulement, si les règles du groupe l'autorisent." },
    messagePriveAutorise: false,
    prerequis: [],
    identifiants: [],
    frequenceMinMinutes: null,
    cout: "—",
    references: ["https://developers.facebook.com/community/threads/584177870580474/"],
    verifieLe: "2026-10-16",
  },
  {
    id: "leboncoin",
    nom: "Leboncoin",
    description: "Annonces de services.",
    acces: "aucun",
    statut: "ecartee",
    lit: [],
    reponsePublique: { automatiseeAutorisee: false, manuellePossible: false, note: "Aucune API publique ; extraction condamnée en justice (affaire Jinka, 2024)." },
    messagePriveAutorise: false,
    prerequis: [],
    identifiants: [],
    frequenceMinMinutes: null,
    cout: "—",
    references: ["https://www.mysweetimmo.com/2024/06/06/immobilier-jinka-condamnee-pour-extraction-et-reutilisation-illicites-dannonces-immobilieres-du-site-leboncoin/"],
    verifieLe: "2026-10-16",
  },
  {
    id: "x_twitter",
    nom: "X (Twitter)",
    description: "Recherche de publications récentes.",
    acces: "api",
    statut: "ecartee",
    lit: [],
    reponsePublique: { automatiseeAutorisee: false, manuellePossible: true, note: "API payante à l'usage ; les règles d'automatisation de X interdisent les réponses automatiques non sollicitées." },
    messagePriveAutorise: false,
    prerequis: [],
    identifiants: [],
    frequenceMinMinutes: null,
    cout: "Payant à l'usage",
    references: ["https://www.postproxy.dev/blog/x-api-pricing-2026/"],
    verifieLe: "2026-10-16",
  },
  {
    id: "reddit",
    nom: "Reddit",
    description: "Forums publics.",
    acces: "api",
    statut: "ecartee",
    lit: [],
    reponsePublique: { automatiseeAutorisee: false, manuellePossible: false, note: "API gratuite réservée à l'usage non commercial ; usage commercial sur accord payant ; la plupart des forums interdisent la publicité." },
    messagePriveAutorise: false,
    prerequis: [],
    identifiants: [],
    frequenceMinMinutes: null,
    cout: "Sur accord",
    references: ["https://octolens.com/blog/reddit-api-pricing"],
    verifieLe: "2026-10-16",
  },
];

export function getSource(id: string): SourceDescriptor | undefined {
  return SOURCES.find((s) => s.id === id);
}
