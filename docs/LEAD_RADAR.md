# Lead Radar — état et architecture

Module de détection et de qualification des demandes de serrurerie en
Île-de-France pour Serrurerie Louis & Fils. Ce document décrit **ce qui
fonctionne réellement** et ce qui reste à brancher.

## État au 2026-10-16

| Brique | État | Testé |
|---|---|---|
| Qualification (besoin, urgence, type de contenu, score /100 expliqué, catégorie) | ✅ Code prêt | ✅ Vitest |
| Localisation (1 266 communes IDF, codes postaux, arrondissements, départements, distance) | ✅ Code prêt | ✅ Vitest |
| Déduplication (identifiant source, URL normalisée, empreinte du texte) | ✅ Code prêt | ✅ Vitest |
| Réponses proposées (numéro 01 85 50 02 70, sans prix ni délai promis) | ✅ Code prêt | ✅ Vitest |
| Décision surveillance / assisté / automatique | ✅ Code prêt | ✅ Vitest |
| Connecteur « Alertes web (RSS) » | ✅ Code prêt | ✅ Sur flux d'exemple. **Pas encore sur un vrai flux** (alertes à créer). |
| Stockage des opportunités | ❌ À faire | Base PostgreSQL non créée |
| Tâches planifiées | ❌ À faire | Aucune tâche déployée |
| Alertes e-mail du radar | ❌ À faire | |
| Interface Lead Radar dans /admin | ❌ À faire | |

**Le radar ne tourne pas encore en production** : il n'y a ni stockage ni
planification déployés. Rien n'est publié nulle part.

## Architecture

```
Sources (connecteurs)          Cœur (src/lib/radar, pur, testé)              Sorties
─────────────────────          ────────────────────────────────              ───────
Alertes RSS ──┐                ┌─ dedupe.ts    doublons                     Base PostgreSQL (à venir)
Formulaire ───┼─ RawItem[] ──▶ │  qualify.ts   besoin, urgence, zone, score ─▶ Alertes Resend (à venir)
Webhook Ads ──┤                │  respond.ts   réponse + décision           Onglet Lead Radar (à venir)
Import CSV ───┘                └─ pipeline.ts  enchaîne le tout
```

- `config.ts` : numéro, départements, base d'intervention (Aubervilliers,
  d'après l'adresse légale), rayon et horaires (`null` tant que non fournis).
- `sources.ts` : registre des sources avec, pour chacune, ce qu'elle permet de
  lire, si une réponse est possible, les identifiants requis, le coût et la
  date de vérification. Les sources écartées y sont documentées avec la raison.
- `respond.ts` : `decideAction` ne renvoie `publier` que si **toutes** ces
  conditions sont réunies :
  1. la source autorise les réponses automatisées (aucune aujourd'hui) ;
  2. conditions vérifiées et activées dans l'administration ;
  3. test de publication réussi ;
  4. identifiants présents ;
  5. source non suspendue.
  Les messages privés promotionnels ne sont jamais envoyés.

## Score (0-100) — n'est pas une probabilité de conversion

| Critère | Points |
|---|---|
| Urgence explicite (« urgent », « maintenant », « ce soir »…) | 30 (20 si situation urgente par nature sans mot d'urgence) |
| Localisation : commune dans un département couvert | 25 (15 au-delà du rayon prioritaire s'il est renseigné ; 12 si seul le département est connu) |
| Prestation proposée reconnue | 20 (10 si « serrurier » sans précision) |
| Récence | 15 (≤ 2 h), 12 (≤ 24 h), 8 (≤ 3 j), 4 (≤ 7 j), 0 sinon |
| Source : réponse possible | 10 si automatisée autorisée, 5 si manuelle seulement |

Catégories : `CRITIQUE` (≥ 75 et urgente), `HAUTE` (≥ 55), `NORMALE`,
`HORS_ZONE`, `NON_PERTINENT` (publicité, article, annuaire, aucun besoin,
plus de 30 jours), `DOUBLON`, `A_VERIFIER` (vraie demande non certaine ou lieu
inconnu).

## Créer les alertes RSS (action du propriétaire)

1. Sur https://www.google.com/alerts, connecté au compte Google de l'entreprise.
2. Pour chaque requête (ex. `"porte claquée" Créteil`, `"cherche un serrurier" Paris`),
   ouvrir **Afficher les options** :
   - Fréquence : « Au fil de l'eau » ;
   - Langue : Français ;
   - Région : France ;
   - **Envoyer à : Flux RSS**.
3. Copier l'URL de chaque flux (icône RSS).

Les URL seront enregistrées dans la variable `RADAR_RSS_FEEDS` (sur Vercel,
jamais dans Git). Alternative : Talkwalker Alerts, qui propose aussi le RSS.

Limite à connaître : ces alertes signalent des **pages nouvellement indexées**,
souvent avec retard. Elles conviennent mal aux urgences immédiates et ne donnent
**aucun droit de publier** sur les sites trouvés.

## Variables d'environnement prévues (noms uniquement)

| Variable | Usage | État |
|---|---|---|
| `RADAR_RSS_FEEDS` | URL des flux d'alertes, séparées par des virgules | à créer |
| `DATABASE_URL` | Base PostgreSQL (Neon, UE) | à créer après accord |
| `CRON_SECRET` | Authentifie l'appel des tâches planifiées | à créer |
| `BRAVE_SEARCH_API_KEY` | Connecteur Brave (optionnel, payant) | non prévu pour l'instant |
| `GOOGLE_ADS_WEBHOOK_KEY` | Webhook des formulaires de leads Ads (optionnel) | non prévu pour l'instant |

## Commandes

```bash
npm test           # tests Vitest (données fictives uniquement)
npm run typecheck
npm run lint
npm run build
```
