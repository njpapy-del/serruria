// ─────────────────────────────────────────────────────────────────────────
// CONFIGURATION CENTRALE DU SITE SERRURIA
// Tout ce qui est propre à l'entreprise (nom, téléphone, villes, tarifs,
// avis, mentions légales, tracking) se configure ICI et nulle part ailleurs.
// Les valeurs marquées "PLACEHOLDER" doivent être remplacées par les vraies
// informations fournies par le client avant la mise en ligne définitive.
//
// Les prix, photos et textes de section vivent dans `content.json` — c'est
// ce fichier que l'espace admin (/admin) modifie via des commits GitHub.
// ─────────────────────────────────────────────────────────────────────────

import content from "./content.json";

function digitsOnly(value: string): string {
  return (value || "").replace(/\D/g, "");
}

/** "0754471250" -> "07 54 47 12 50". Repli sur la valeur brute si le format est inattendu. */
function formatPhoneDisplay(raw: string): string {
  const digits = digitsOnly(raw);
  if (digits.length !== 10) return raw;
  return digits.match(/.{1,2}/g)!.join(" ");
}

/** "0754471250" ou "33754471250" -> "33754471250" (format attendu par wa.me). */
function toWhatsappNumber(raw: string): string {
  const digits = digitsOnly(raw);
  if (digits.length === 10 && digits.startsWith("0")) return `33${digits.slice(1)}`;
  return digits;
}

/** "0754471250" -> "tel:0754471250" (format national). */
function toTelHref(raw: string): string {
  const digits = digitsOnly(raw);
  if (!digits) return "";
  const national = digits.startsWith("33") && digits.length === 11 ? `0${digits.slice(2)}` : digits;
  return `tel:${national}`;
}

export type Ville = {
  slug: string;
  nom: string;
  departement: string;
  /** Tournure avec préposition ("à Paris", "en Essonne", "dans les Yvelines"). Défaut : "à {nom}". */
  lieu?: string;
  /** Communes ou arrondissements couverts autour de cette ville */
  secteurs: string[];
};

export type Tarif = {
  id: string;
  label: string;
  /** Prix de départ en euros. Laisser `null` tant que le client n'a pas fourni le vrai tarif. */
  priceFrom: number | null;
  /** true = prix fixe garanti ("49 € prix fixe") plutôt qu'un prix de départ variable. */
  fixed?: boolean;
  /**
   * Texte libre affiché à la place du prix (ex. "Sur devis selon modèle").
   * Prioritaire sur `priceFrom` s'il est renseigné. Si vide ET `priceFrom`
   * vide, affiche "Sur devis" par défaut.
   */
  customText?: string;
};

export type Avis = {
  prenom: string;
  ville: string;
  note: 1 | 2 | 3 | 4 | 5;
  commentaire: string;
  titre?: string;
};

export const siteConfig = {
  brand: {
    name: "Serrurerie Louis & Fils",
    slogan: content.brand.slogan,
    positioning: content.brand.positioning,
  },

  // Téléphone, WhatsApp, email et infos légales sont modifiables depuis /admin
  // (onglet "Coordonnées") — content.json est la source, jamais codée en dur ici.
  contact: {
    phoneDisplay: formatPhoneDisplay(content.contact.phoneNumber),
    phoneHref: toTelHref(content.contact.phoneNumber),

    // Vide désactive le bouton WhatsApp (pas de faux numéro affiché).
    whatsappNumber: toWhatsappNumber(content.contact.whatsappNumber),
    get whatsappHref() {
      return this.whatsappNumber
        ? `https://wa.me/${this.whatsappNumber}?text=${encodeURIComponent(
            "Bonjour, je souhaite demander une intervention de serrurerie.\nMa ville est : \nMon problème est : "
          )}`
        : null;
    },

    email: content.contact.email,
  },

  legal: {
    companyName: content.legal.companyName,
    siret: content.legal.siret,
    address: content.legal.address,
    // true dès que les 3 champs ci-dessus sont renseignés (contrôle l'affichage
    // des données structurées LocalBusiness/Locksmith) — pas de bascule manuelle
    // séparée à oublier : si l'admin a rempli ces champs, l'info est réelle.
    get dataConfirmed() {
      return Boolean(this.companyName && this.siret && this.address);
    },
  },

  hero: {
    badge: content.hero.badge,
    title: content.hero.title,
    subtitle: content.hero.subtitle,
    accroche: content.hero.accroche,
    slogans: content.hero.slogans,
    videoSrc: "/videos/hero.mp4",
    posterSrc: "/images/hero-poster.jpg",
  },

  trustBullets: content.trustBullets,

  // `photos` : liste vide tant qu'aucune vraie photo n'est fournie — la carte
  // affiche alors une icône de secours. Avec plusieurs photos, elles défilent
  // en fondu dans le cadre. Modifiable depuis /admin.
  problemes: content.problemes,

  // Partenaires assurances confirmés par le client. Logos officiels sourcés
  // directement depuis Wikimedia Commons (jamais copiés depuis un site tiers).
  partners: [
    { name: "AXA", logo: "/images/partners/axa.svg" },
    { name: "Allianz", logo: "/images/partners/allianz.svg" },
    { name: "Generali", logo: "/images/partners/generali.svg" },
    { name: "Groupama", logo: "/images/partners/groupama.svg" },
    { name: "MACIF", logo: "/images/partners/macif.svg" },
    { name: "MAIF", logo: "/images/partners/maif.svg" },
    { name: "MAAF", logo: "/images/partners/maaf.jpg" },
    { name: "Matmut", logo: "/images/partners/matmut.svg" },
    { name: "Crédit Agricole", logo: "/images/partners/credit-agricole.svg" },
    { name: "LCL", logo: "/images/partners/lcl.svg" },
    { name: "BNP Paribas", logo: "/images/partners/bnp-paribas.svg" },
    { name: "Caisse d'Épargne", logo: "/images/partners/caisse-epargne.svg" },
  ],

  // NE PAS INVENTER LES PRIX : priceFrom reste `null` jusqu'à ce que le client
  // fournisse les vrais tarifs. `null` affiche « À partir de XX € ». Modifiable depuis /admin.
  tarifs: content.tarifs as Tarif[],

  // Bandeau promotionnel animé (défile en boucle). Modifiable depuis /admin.
  promo: content.promo,

  // Modifiables depuis /admin.
  etapes: content.etapes,
  services: content.services,
  confiance: content.confiance,

  // Avis clients réels fournis par le client.
  avis: [
    {
      prenom: "Thomas",
      ville: "Paris",
      note: 5,
      titre: "Intervention rapide et professionnelle",
      commentaire:
        "J'étais bloqué devant ma porte après avoir claqué la porte avec les clés à l'intérieur. Le serrurier a été très professionnel et m'a expliqué l'intervention avant de commencer. Travail propre et rapide.",
    },
    {
      prenom: "Julien",
      ville: "Boulogne-Billancourt",
      note: 5,
      titre: "Prix annoncé avant l'intervention",
      commentaire:
        "Ma serrure était complètement bloquée et je ne pouvais plus rentrer chez moi. J'ai apprécié le fait que le tarif soit expliqué avant l'intervention. Le travail a été réalisé rapidement et proprement.",
    },
    {
      prenom: "Sophie",
      ville: "Montreuil",
      note: 5,
      titre: "Très bonne prise en charge",
      commentaire:
        "Clé cassée dans la serrure en rentrant chez moi. J'ai appelé et j'ai rapidement pu expliquer mon problème. Intervention sérieuse, serrurier ponctuel et très professionnel.",
    },
    {
      prenom: "Nicolas",
      ville: "Paris",
      note: 5,
      titre: "Je recommande",
      commentaire:
        "Intervention pour une porte claquée. Le serrurier a pris le temps de regarder la serrure avant d'intervenir et a réussi à ouvrir la porte sans l'endommager. Très satisfait du service.",
    },
    {
      prenom: "Camille",
      ville: "Saint-Denis",
      note: 5,
      titre: "Après une serrure bloquée",
      commentaire:
        "Ma serrure ne fonctionnait plus correctement et la porte était impossible à ouvrir. Le problème a été identifié rapidement et la serrure a été remplacée proprement. Merci pour le sérieux.",
    },
    {
      prenom: "Laura",
      ville: "Versailles",
      note: 5,
      titre: "Service rassurant",
      commentaire:
        "J'étais assez stressée car je ne pouvais plus entrer chez moi. L'intervention s'est bien passée et le serrurier m'a expliqué les différentes possibilités avant de faire les travaux. Je recommande.",
    },
  ] as Avis[],

  // Départements d'intervention fournis par le client. NE PAS INVENTER DE ZONES.
  villes: [
    { slug: "paris", nom: "Paris", departement: "Paris (75)", lieu: "à Paris", secteurs: [] },
    { slug: "seine-et-marne", nom: "Seine-et-Marne", departement: "Département 77", lieu: "en Seine-et-Marne", secteurs: [] },
    { slug: "yvelines", nom: "Yvelines", departement: "Département 78", lieu: "dans les Yvelines", secteurs: [] },
    { slug: "essonne", nom: "Essonne", departement: "Département 91", lieu: "en Essonne", secteurs: [] },
    { slug: "hauts-de-seine", nom: "Hauts-de-Seine", departement: "Département 92", lieu: "dans les Hauts-de-Seine", secteurs: [] },
    { slug: "seine-saint-denis", nom: "Seine-Saint-Denis", departement: "Département 93", lieu: "en Seine-Saint-Denis", secteurs: [] },
    { slug: "val-de-marne", nom: "Val-de-Marne", departement: "Département 94", lieu: "dans le Val-de-Marne", secteurs: [] },
    { slug: "val-d-oise", nom: "Val-d'Oise", departement: "Département 95", lieu: "dans le Val-d'Oise", secteurs: [] },
  ] as Ville[],

  // Modifiable depuis /admin.
  faq: content.faq,

  tracking: {
    // Laisser vide désactive tout chargement de script de tracking.
    gtmId: process.env.NEXT_PUBLIC_GTM_ID ?? "",
  },

  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://serrurerielouisfils.com",
};

export type SiteConfig = typeof siteConfig;
