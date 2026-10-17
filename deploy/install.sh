#!/usr/bin/env bash
# Installation du Lead Radar sur un serveur Debian/Ubuntu (à lancer en root).
# Usage : sudo bash install.sh
set -euo pipefail

REPO="https://github.com/njpapy-del/serruria.git"
DIR=/opt/lead-radar

[[ $EUID -eq 0 ]] || { echo "À lancer en root (sudo)." >&2; exit 1; }

apt-get update -qq
apt-get install -y -qq git python3 curl ca-certificates util-linux >/dev/null

# Node 22 (moteur de qualification TypeScript)
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi

id leadradar >/dev/null 2>&1 || useradd --system --home /var/lib/lead-radar --shell /usr/sbin/nologin leadradar

if [[ -d "$DIR/.git" ]]; then
  git -C "$DIR" pull --ff-only
else
  git clone --depth 1 "$REPO" "$DIR"
fi
cd "$DIR"
npm ci --no-audit --no-fund --omit=optional >/dev/null || npm ci --no-audit --no-fund >/dev/null
chown -R root:root "$DIR"

if [[ ! -f /etc/lead-radar.env ]]; then
  install -m 600 -o root -g root deploy/lead-radar.env.example /etc/lead-radar.env
  echo ">>> Renseignez /etc/lead-radar.env puis relancez ce script."
  exit 0
fi
chmod 600 /etc/lead-radar.env

install -m 644 deploy/systemd/*.service deploy/systemd/*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now lead-radar.timer lead-radar-gsc.timer

# Vérifications : test d'envoi d'e-mail puis un premier passage réel.
sudo -u leadradar bash -c "set -a; . /etc/lead-radar.env; set +a; cd $DIR/agent && python3 -m lead_radar_agent --mode resend-check" || echo "!!! Le test d'e-mail a échoué : vérifiez la configuration Resend."
systemctl start lead-radar.service || true
journalctl -u lead-radar.service -n 5 --no-pager
systemctl list-timers 'lead-radar*' --no-pager
echo ">>> Installé. Désactivez ensuite la planification GitHub : gh variable set RADAR_GITHUB_SCHEDULE --body off"
