# lead-radar-agent

Agent Python autonome du Lead Radar (Serrurerie Louis & Fils). Il recherche des
publications publiques, les qualifie avec le moteur TypeScript du site
(`scripts/radar-cli.ts`) et envoie les alertes par e-mail via Resend.
Bibliothèque standard Python 3.12 uniquement ; Node 22+ et `npm ci` à la racine
pour le moteur de qualification.

## Ce qui fonctionne réellement (vérifié le 2026-10-16)

| Source | État | Test réel |
|---|---|---|
| Bluesky (API publique officielle) | ✅ Active | 16 requêtes, 50 publications analysées sur 30 jours, 0 erreur, **0 demande de serrurier en IDF trouvée** |
| Alertes RSS (Google Alerts, Talkwalker) | ⏸ En attente | Code testé sur flux d'exemple ; aucun flux fourni (`RADAR_RSS_FEEDS`) |
| Brave Search API | 🔒 Désactivée | Exige accord du propriétaire (carte bancaire), clé et budget > 0 |

Aucune publication automatique n'existe dans l'agent. Les messages privés ne
sont jamais envoyés.

## Modes

```bash
cd agent
python3 -m lead_radar_agent --mode test                  # données fictives, aucun e-mail
python3 -m lead_radar_agent --mode test --send-email     # idem, e-mails réels préfixés [TEST]
python3 -m lead_radar_agent --mode surveillance          # sources réelles, alertes sans réponse proposée
python3 -m lead_radar_agent --mode assiste               # sources réelles, alertes avec réponse proposée
python3 -m lead_radar_agent --mode assiste --no-email    # sans envoi
```

Code de sortie 1 si une recherche ou une notification a échoué : une erreur
n'est jamais présentée comme une recherche sans résultat.

## Variables d'environnement (jamais dans Git)

| Variable | Rôle |
|---|---|
| `RESEND_API_KEY` | Envoi des alertes (même compte Resend que le site) |
| `LEAD_RADAR_SENDER_EMAIL` | Expéditeur, sur le domaine vérifié (ex. `Lead Radar <radar@serrurerielouisfils.com>`) |
| `LEAD_RADAR_NOTIFICATION_EMAIL` | Destinataire(s), séparés par des virgules |
| `RADAR_RSS_FEEDS` | URL des flux d'alertes RSS (facultatif) |
| `BRAVE_SEARCH_API_KEY` | Brave Search (facultatif, désactivé par défaut) |

## Alertes envoyées

- **Urgentes** : un e-mail par prospect, objet `[LEAD RADAR] [URGENT] Porte claquée — Aubervilliers (93)`.
- **Non urgentes** : regroupées (10 par e-mail maximum).
- **Panne** : après 3 échecs consécutifs d'une source, une alerte par jour.
- **Synthèse quotidienne** : après 20 h (heure de Paris) : passages, recherches,
  sources consultées, éléments analysés, demandes, notifications, erreurs.

Seules les classes `DEMANDE_CONFIRMEE` et `DEMANDE_PROBABLE` avec un score ≥ 45
déclenchent une alerte (réglable dans `config.json`). Un prospect n'est notifié
qu'une fois (empreinte dans l'état + clé d'idempotence Resend). Un e-mail
contenant l'ancien numéro 07 54 47 12 50 est bloqué avant envoi.

## Données et dépôt public

- L'état (`agent/.state/state.json`, ignoré par Git) ne contient **que des
  empreintes SHA-256**, des compteurs et la santé des sources. Aucune URL ni
  texte de prospect.
- Les journaux affichent uniquement des compteurs et des codes d'erreur : les
  journaux GitHub Actions d'un dépôt public sont publics.
- Le texte des publications n'existe qu'en mémoire pendant l'exécution, puis
  dans l'e-mail envoyé à l'entreprise.
- Brave : les conditions interdisent de stocker les résultats ; rien n'est
  persisté. Les empreintes de déduplication sont à faire valider par Brave avant
  activation.
- Rétention des empreintes : 60 jours (`retention_days`).

## Tests

```bash
cd agent && python3 -m unittest discover -s tests -t .
```

Données fictives uniquement (domaine `exemple.invalid`).
