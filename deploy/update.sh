#!/usr/bin/env bash
# Mise à jour du code sur le serveur (sudo bash update.sh). L'état et la configuration sont conservés.
set -euo pipefail
cd /opt/lead-radar
git pull --ff-only
npm ci --no-audit --no-fund >/dev/null
install -m 644 deploy/systemd/*.service deploy/systemd/*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl restart lead-radar.timer lead-radar-gsc.timer
git log --oneline -1
