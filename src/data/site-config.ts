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
  /** true = prix fixe garanti ("49 € prix fixe") plutôt qu'un prix de départ variable. */
  fixed?: boolean;
};

export type Avis = {
  prenom: string;
  ville: string;
  note: 1 | 2 | 3 | 4 | 5;
  commentaire: string;
  titre?: string;
};

export type Technicien = {
  name: string;
  initials: string;
  zone: string;
  lat: number;
  lng: number;
  status: "disponible" | "intervention";
  /** Dernière mission terminée, ou mission en cours si `status` = "intervention". */
  mission: string;
  /** Texte d'estimation ("~18 min", "Libre dans ~13 min"...). */
  eta: string;
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

  // Carte de l'équipe : positions illustratives dans la région parisienne, à
  // affiner ou reconnecter à un vrai suivi de flotte quand disponible.
  team: {
    mapCenter: { lat: 48.75, lng: 2.5 },
    mapZoom: 9,
    technicians: [
      { name: "Damien", initials: "DA", zone: "Paris (75)", lat: 48.8566, lng: 2.3522, status: "disponible", mission: "Changement de serrure rue de Rivoli — Terminée il y a 6 min", eta: "~15 min" },
      { name: "Pascal", initials: "PA", zone: "Hauts-de-Seine (92)", lat: 48.8924, lng: 2.2469, status: "disponible", mission: "Ouverture de porte à Levallois-Perret — Terminée il y a 4 min", eta: "~18 min" },
      { name: "Joseph", initials: "JO", zone: "Seine-Saint-Denis (93)", lat: 48.9362, lng: 2.3574, status: "intervention", mission: "Ouverture de porte blindée à Saint-Denis (en cours)", eta: "Libre dans ~20 min" },
      { name: "Mohamed", initials: "MO", zone: "Val-de-Marne (94)", lat: 48.7911, lng: 2.4139, status: "disponible", mission: "Mise en sécurité à Créteil — Terminée il y a 11 min", eta: "~12 min" },
      { name: "Ibrahim", initials: "IB", zone: "Seine-Saint-Denis (93)", lat: 48.9089, lng: 2.4467, status: "disponible", mission: "Clé cassée à Aulnay-sous-Bois — Terminée il y a 9 min", eta: "~16 min" },
      { name: "Raphaël", initials: "RA", zone: "Paris (75)", lat: 48.8737, lng: 2.3614, status: "disponible", mission: "Changement de cylindre à Montmartre — Terminée il y a 22 min", eta: "~10 min" },
      { name: "Uriel", initials: "UR", zone: "Hauts-de-Seine (92)", lat: 48.8404, lng: 2.2137, status: "intervention", mission: "Serrure bloquée à Boulogne-Billancourt (en cours)", eta: "Libre dans ~13 min" },
      { name: "Momo", initials: "MM", zone: "Val-de-Marne (94)", lat: 48.8323, lng: 2.4425, status: "disponible", mission: "Sécurisation de porte à Vincennes — Terminée il y a 15 min", eta: "~14 min" },
      { name: "Nathan", initials: "NA", zone: "Paris (75)", lat: 48.8462, lng: 2.3372, status: "disponible", mission: "Ouverture de porte claquée à Montparnasse — Terminée il y a 3 min", eta: "~17 min" },
      { name: "Antoine", initials: "AN", zone: "Seine-Saint-Denis (93)", lat: 48.8631, lng: 2.4419, status: "disponible", mission: "Changement de serrure à Montreuil — Terminée il y a 8 min", eta: "~19 min" },
      { name: "Yanis", initials: "YA", zone: "Val-de-Marne (94)", lat: 48.8144, lng: 2.3958, status: "disponible", mission: "Blindage de porte à Ivry-sur-Seine — Terminée il y a 25 min", eta: "~11 min" },
    ] as Technicien[],
  },

  // NE PAS INVENTER LES PRIX : priceFrom reste `null` jusqu'à ce que le client
  // fournisse les vrais tarifs. `null` affiche « À partir de XX € ».
  tarifs: [
    { id: "ouverture-porte", label: "Ouverture de porte", priceFrom: null },
    { id: "porte-claquee", label: "Porte claquée", priceFrom: 49, fixed: true },
    { id: "cle-cassee", label: "Clé cassée", priceFrom: null },
    { id: "changement-cylindre", label: "Changement de cylindre", priceFrom: null },
    { id: "changement-serrure", label: "Changement de serrure", priceFrom: null },
    { id: "mise-en-securite", label: "Mise en sécurité", priceFrom: null },
    { id: "blindage", label: "Blindage", priceFrom: null },
  ] as Tarif[],

  // Bandeau promotionnel animé (défile en boucle). `null`/vide pour le masquer.
  promo: {
    text: "Ouverture de porte claquée : 49 € prix fixe, sans surprise",
    tag: "Pas cher",
  },

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
