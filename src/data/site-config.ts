// ─────────────────────────────────────────────────────────────────────────
// CONFIGURATION CENTRALE DU SITE SERRURIA
// Tout ce qui est propre à l'entreprise (nom, téléphone, villes, tarifs,
// avis, mentions légales, tracking) se configure ICI et nulle part ailleurs.
// Les valeurs marquées "PLACEHOLDER" doivent être remplacées par les vraies
// informations fournies par le client avant la mise en ligne définitive.
// ─────────────────────────────────────────────────────────────────────────

export type Ville = {
  slug: string;
  nom: string;
  departement: string;
  /** Communes ou arrondissements couverts autour de cette ville */
  secteurs: string[];
};

export type Tarif = {
  id: string;
  label: string;
  /** Prix de départ en euros. Laisser `null` tant que le client n'a pas fourni le vrai tarif. */
  priceFrom: number | null;
};

export type Avis = {
  prenom: string;
  ville: string;
  note: 1 | 2 | 3 | 4 | 5;
  commentaire: string;
};

export const siteConfig = {
  brand: {
    name: "Serrurerie Louis & Fils",
    slogan: "Votre serrurier, quand vous en avez besoin.",
    positioning: "Serrurier d'urgence près de chez vous",
  },

  contact: {
    phoneDisplay: "07 54 47 12 50",
    phoneHref: "tel:+33754471250",

    // PLACEHOLDER — laisser vide désactive le bouton WhatsApp (pas de faux numéro affiché).
    whatsappNumber: "",
    get whatsappHref() {
      return this.whatsappNumber
        ? `https://wa.me/${this.whatsappNumber}?text=${encodeURIComponent(
            "Bonjour, j'ai besoin d'un serrurier."
          )}`
        : null;
    },

    email: "", // PLACEHOLDER
  },

  legal: {
    // PLACEHOLDER — informations légales réelles à fournir par le client.
    companyName: "",
    siret: "",
    address: "",
    // Passer à true uniquement lorsque toutes les infos légales ci-dessus sont réelles
    // (contrôle l'affichage des données structurées LocalBusiness/Locksmith).
    dataConfirmed: false,
  },

  hero: {
    badge: "DISPONIBLE 7J/7",
    title: "Serrurier d'urgence près de chez vous",
    subtitle:
      "Porte claquée, clé cassée, serrure bloquée ? Nous vous accompagnons rapidement.",
    videoSrc: "/videos/hero.mp4",
    posterSrc: "/images/hero-poster.jpg",
  },

  trustBullets: [
    "Disponible 7j/7",
    "Prix annoncé avant intervention",
    "Devis gratuit",
    "Artisan professionnel",
  ],

  // `photos` : liste vide tant qu'aucune vraie photo n'est fournie — la carte
  // affiche alors une icône de secours. Avec plusieurs photos, elles défilent
  // en fondu dans le cadre.
  problemes: [
    {
      id: "porte-claquee",
      label: "Porte claquée",
      photos: ["/images/problemes/porte-claquee.png"],
    },
    {
      id: "porte-verrouillee",
      label: "Porte verrouillée",
      photos: [
        "/images/problemes/porte-verrouillee.png",
        "/images/problemes/porte-verrouillee-2.png",
      ],
    },
    {
      id: "cle-cassee",
      label: "Clé cassée",
      photos: [
        "/images/problemes/cle-cassee.png",
        "/images/problemes/cle-cassee-2.png",
        "/images/problemes/cle-cassee-3.png",
      ],
    },
    {
      id: "cle-perdue",
      label: "Clé perdue",
      photos: [
        "/images/problemes/cle-perdue.png",
        "/images/problemes/cle-perdue-2.png",
      ],
    },
    {
      id: "serrure-bloquee",
      label: "Serrure bloquée",
      photos: [
        "/images/problemes/serrure-bloquee.png",
        "/images/problemes/serrure-bloquee-2.png",
        "/images/problemes/serrure-bloquee-3.png",
      ],
    },
    {
      id: "changement-serrure",
      label: "Changement de serrure",
      photos: [
        "/images/problemes/changement-serrure.png",
        "/images/problemes/changement-serrure-2.png",
        "/images/problemes/changement-serrure-3.png",
      ],
    },
    {
      id: "apres-effraction",
      label: "Après effraction",
      photos: [
        "/images/problemes/apres-effraction.png",
        "/images/problemes/apres-effraction-2.png",
      ],
    },
    {
      id: "securisation-porte",
      label: "Sécurisation de porte",
      photos: [
        "/images/problemes/securisation-porte.png",
        "/images/problemes/securisation-porte-2.png",
        "/images/problemes/securisation-porte-3.png",
      ],
    },
  ],

  // NE PAS INVENTER LES PRIX : priceFrom reste `null` jusqu'à ce que le client
  // fournisse les vrais tarifs. `null` affiche « À partir de XX € ».
  tarifs: [
    { id: "ouverture-porte", label: "Ouverture de porte", priceFrom: null },
    { id: "porte-claquee", label: "Porte claquée", priceFrom: null },
    { id: "cle-cassee", label: "Clé cassée", priceFrom: null },
    { id: "changement-cylindre", label: "Changement de cylindre", priceFrom: null },
    { id: "changement-serrure", label: "Changement de serrure", priceFrom: null },
    { id: "mise-en-securite", label: "Mise en sécurité", priceFrom: null },
    { id: "blindage", label: "Blindage", priceFrom: null },
  ] satisfies Tarif[],

  etapes: [
    { numero: "01", titre: "Vous nous appelez", description: "Un premier contact rapide pour décrire votre situation." },
    { numero: "02", titre: "Nous évaluons votre situation", description: "Nous identifions le type d'intervention nécessaire." },
    { numero: "03", titre: "Le prix est confirmé avant intervention", description: "Aucune mauvaise surprise : le tarif est validé avec vous avant de commencer." },
    { numero: "04", titre: "Le serrurier intervient", description: "Un artisan intervient pour résoudre votre problème." },
  ],

  services: [
    {
      id: "ouverture-porte",
      label: "Ouverture de porte",
      description: "Ouverture de porte claquée ou verrouillée, sans dégradation lorsque cela est possible.",
    },
    {
      id: "changement-serrure",
      label: "Changement de serrure",
      description: "Remplacement complet d'une serrure usée, bloquée ou endommagée.",
    },
    {
      id: "remplacement-cylindre",
      label: "Remplacement de cylindre",
      description: "Changement du cylindre pour restaurer la sécurité de votre porte.",
    },
    {
      id: "cle-cassee",
      label: "Clé cassée",
      description: "Extraction d'une clé cassée dans la serrure et remise en état.",
    },
    {
      id: "serrure-bloquee",
      label: "Serrure bloquée",
      description: "Diagnostic et déblocage d'une serrure qui ne tourne plus.",
    },
    {
      id: "mise-en-securite",
      label: "Mise en sécurité après effraction",
      description: "Sécurisation rapide de votre porte après une tentative d'effraction.",
    },
    {
      id: "blindage-porte",
      label: "Blindage de porte",
      description: "Renforcement de porte pour améliorer la résistance à l'effraction.",
    },
    {
      id: "installation-serrure",
      label: "Installation de serrure",
      description: "Installation d'une nouvelle serrure sur une porte neuve ou existante.",
    },
  ],

  confiance: [
    { label: "Intervention professionnelle", description: "Un artisan qui prend le temps de comprendre votre besoin." },
    { label: "Prix annoncé avant travaux", description: "Le tarif est confirmé avec vous avant toute intervention." },
    { label: "Devis gratuit", description: "Une estimation sans engagement, sans surprise." },
    { label: "Disponible 7j/7", description: "Une disponibilité pensée pour les situations urgentes." },
    { label: "Travail soigné", description: "Une intervention propre et respectueuse de votre porte." },
    { label: "Facture détaillée", description: "Un document clair pour chaque intervention réalisée." },
  ],

  // NE PAS INVENTER D'AVIS. Reste vide tant que le client n'a pas fourni de vrais avis clients.
  avis: [] as Avis[],

  // NE PAS INVENTER DE ZONES. Reste vide tant que le client n'a pas fourni les villes réellement desservies.
  villes: [] as Ville[],

  faq: [
    {
      question: "Intervenez-vous en urgence ?",
      reponse:
        "Oui, nous intervenons pour des situations urgentes comme une porte claquée, une clé cassée ou une serrure bloquée.",
    },
    {
      question: "Combien coûte une ouverture de porte ?",
      reponse:
        "Le tarif exact dépend de votre situation. Il vous est communiqué et confirmé avant toute intervention.",
    },
    {
      question: "Le devis est-il gratuit ?",
      reponse: "Oui, l'estimation de votre demande est gratuite et sans engagement.",
    },
    {
      question: "Le prix est-il annoncé avant intervention ?",
      reponse: "Oui, le prix vous est toujours confirmé avant le début de l'intervention.",
    },
    {
      question: "Intervenez-vous le week-end ?",
      reponse: "Nous sommes disponibles 7j/7. Contactez-nous pour vérifier la disponibilité au moment de votre demande.",
    },
    {
      question: "Pouvez-vous intervenir après une effraction ?",
      reponse: "Oui, nous proposons une mise en sécurité de votre porte après une effraction.",
    },
    {
      question: "Quels types de serrures remplacez-vous ?",
      reponse:
        "Nous intervenons sur la plupart des types de serrures et cylindres. N'hésitez pas à nous décrire votre serrure lors de votre appel.",
    },
  ],

  tracking: {
    // Laisser vide désactive tout chargement de script de tracking.
    gtmId: process.env.NEXT_PUBLIC_GTM_ID ?? "",
  },

  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://serrurerielouisfils.com",
};

export type SiteConfig = typeof siteConfig;
