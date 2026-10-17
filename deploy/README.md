# Déploiement du Lead Radar sur un serveur dédié

Objectif : un passage toutes les 10 minutes, 24 h/24, indépendant de GitHub
Actions (dont la planification est « au mieux » : mesuré le 16/10/2026, 2 passages
en 7 h 30 au lieu de 15, et dont les conditions excluent les usages sans rapport
avec le projet logiciel).

## 1. Serveur (commande par le propriétaire)

Recommandé : Scaleway, Paris (PAR-1), Debian 12 ou Ubuntu 24.04.

| Offre | Prix public constaté le 17/10/2026 (HT) | Remarque |
|---|---|---|
| STARDUST1-S (1 vCPU, 1 Go) | ~0,43 €/mois | souvent indisponible ; IPv4 et disque facturés en plus |
| DEV1-S (2 vCPU, 2 Go) | ~6,55 €/mois | IPv4 et disque facturés en plus |

Source : https://www.scaleway.com/en/pricing/virtual-instances/ — vérifier le
total (IPv4 + disque) au moment de la commande.

## 2. Installation

```bash
ssh root@IP_DU_SERVEUR
curl -fsSLO https://raw.githubusercontent.com/njpapy-del/serruria/main/deploy/install.sh
bash install.sh            # 1er lancement : crée /etc/lead-radar.env puis s'arrête
nano /etc/lead-radar.env   # saisir les NOUVELLES clés (jamais dans Git ni dans un chat)
bash install.sh            # installe les timers, teste l'e-mail, lance un 1er passage
```

## 3. Détection de panne (gratuit)

1. Créer un « check » sur https://healthchecks.io : période 10 min, tolérance 30 min.
2. Copier l'URL de ping dans `HEALTHCHECK_PING_URL`.
3. Le robot envoie un signal à chaque passage réussi et `/fail` en cas d'échec,
   ou si aucune recherche n'a été faite ; sans signal, Healthchecks envoie un e-mail.

## 4. Couper la planification GitHub (éviter les alertes en double)

```bash
gh variable set RADAR_GITHUB_SCHEDULE --body off -R njpapy-del/serruria
```

Les lancements manuels (test, resend-check, gsc-report) restent possibles.

## 5. Vérifier que le robot tourne

```bash
systemctl list-timers 'lead-radar*'          # prochains passages
journalctl -u lead-radar.service -n 50       # journal (métriques uniquement)
python3 -c "import json;d=json.load(open('/var/lib/lead-radar/state.json'));print(d['last_run'], len(d['runs']))"
```

## 6. Mise à jour

```bash
sudo bash /opt/lead-radar/deploy/update.sh
```

## Garanties

- Un seul passage à la fois (`flock`), arrêt d'un passage bloqué après 15 min.
- État sur disque (`/var/lib/lead-radar`) : plafonds Brave fiables (≤ 24
  requêtes/jour, budget mensuel vérifié avant chaque appel, aucun résultat Brave conservé).
- Bluesky : au plus 10 requêtes par passage, 1 500 par jour.
- Service sans privilèges (`leadradar`), système de fichiers en lecture seule hors état.
