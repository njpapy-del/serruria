"""Rapport Search Console (lecture seule) via scripts/gsc-report.ts.

Search Console montre les recherches Google pour lesquelles CE site est apparu
(données agrégées, 2 à 3 jours de retard). Elle ne donne pas les recherches des
internautes en général ni leur identité.
"""

from __future__ import annotations

import json
import subprocess

from .qualify import REPO_ROOT


class GscNotConfigured(Exception):
    pass


class GscError(Exception):
    pass


def fetch_report(env: dict, runner=subprocess.run) -> dict:
    if not env.get("GSC_SERVICE_ACCOUNT_JSON") or not env.get("GSC_PROPERTY"):
        raise GscNotConfigured("Search Console non configurée (GSC_SERVICE_ACCOUNT_JSON, GSC_PROPERTY)")
    tsx = REPO_ROOT / "node_modules" / ".bin" / "tsx"
    proc = runner([str(tsx), "scripts/gsc-report.ts"], capture_output=True, text=True, cwd=REPO_ROOT, timeout=120, env=env)
    if proc.returncode != 0:
        try:
            err = json.loads(proc.stderr.strip().splitlines()[-1])
        except (ValueError, IndexError):
            err = {"error": "inconnue", "message": proc.stderr.strip()[:200]}
        raise GscError(f"Search Console : {err.get('error')} — {err.get('message')}")
    return json.loads(proc.stdout)


def report_email(r: dict) -> tuple[str, str]:
    t = r["totaux"]
    p = r["periode"]
    lines = [
        f"Propriété : {r['property']}",
        f"Période : {p['debut']} → {p['fin']} ({p['note']})",
        "",
        f"Impressions : {t['impressions']} — Clics : {t['clics']} — CTR : {t['ctr'] * 100:.1f} % — Position moyenne : {t['positionMoyenne'] if t['positionMoyenne'] is not None else 'n/d'}",
        "",
        "Requêtes principales (France) :",
        *[f"  - {q['requete']} : {q['impressions']} impressions, {q['clics']} clics, position {q['position']:.1f}" for q in r["requetes"][:15]],
        "",
        "Pages principales :",
        *[f"  - {pg['page']} : {pg['impressions']} impressions, {pg['clics']} clics, position {pg['position']}" for pg in r["pages"][:10]],
        "",
        "Opportunités de serrurerie (déjà vues par Google, mal classées ou peu cliquées) :",
        *([f"  - {o['requete']} : {o['impressions']} impressions, position {o['position']} — {o['raison']}" for o in r["opportunites"]] or ["  - aucune pour l'instant"]),
        "",
        "Ces chiffres concernent les apparitions de VOTRE site dans Google. Ce ne sont ni des appels ni des clients.",
    ]
    return f"[SEARCH CONSOLE] Rapport — {p['debut']} → {p['fin']}", "\n".join(lines)
