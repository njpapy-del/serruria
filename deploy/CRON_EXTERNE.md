# Déclenchement externe gratuit (cron-job.org → GitHub Actions)

Pourquoi : la planification intégrée de GitHub (« schedule ») est « au mieux ».
Mesuré les 16-17/10/2026 : un passage toutes les 4 à 5 h au lieu d'un par heure.
Un appel externe toutes les 15 min lance le même workflow via l'API officielle
`workflow_dispatch`.

Coût : 0 € (cron-job.org : « entièrement gratuit », jusqu'à 1 appel/min ;
GitHub Actions : gratuit pour les dépôts publics, runners standards).

## 1. Jeton GitHub limité (fine-grained)

GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token :

- Repository access : **Only select repositories** → `njpapy-del/serruria`
- Permissions → Repository → **Actions : Read and write** (rien d'autre)
- Expiration : 90 jours (à renouveler)

Ce jeton ne permet que de lancer et lire les workflows de ce dépôt. Il est
confié à cron-job.org : c'est le risque principal de cette option.

## 2. Tâche cron-job.org

- URL : `https://api.github.com/repos/njpapy-del/serruria/actions/workflows/lead-radar.yml/dispatches`
- Méthode : **POST**
- Planification : toutes les 15 minutes
- En-têtes :
  - `Authorization: Bearer <jeton du point 1>`
  - `Accept: application/vnd.github+json`
  - `X-GitHub-Api-Version: 2022-11-28`
  - `Content-Type: application/json`
- Corps :

```json
{"ref":"main","inputs":{"mode":"assiste","declencheur":"externe"}}
```

Réponse attendue : **204** (aucun contenu).

## 3. Garanties de coût (Brave)

`declencheur=externe` autorise Brave, avec trois bornes :
1. 4 créneaux par jour (8 h, 12 h, 16 h, 20 h, heure de Paris) ;
2. seulement les **15 premières minutes** du créneau : avec un appel toutes les
   15 min, au plus **un** passage Brave par créneau, même si l'état est perdu ;
3. 6 requêtes par passage, 24 par jour, budget mensuel vérifié avant chaque appel.

Maximum théorique : 4 × 6 × 31 = 744 requêtes/mois × 0,005 $ = 3,72 $ (crédit gratuit de 5 $).

## 4. Doublons

Les passages sont exécutés l'un après l'autre (`concurrency: lead-radar`) et
partagent le même état : une même demande ne déclenche qu'une alerte. La
planification GitHub peut rester active en secours.

## 5. Vérifier

```bash
gh run list -R njpapy-del/serruria -w lead-radar.yml -L 10
```

Les passages déclenchés apparaissent avec l'événement `workflow_dispatch`.
