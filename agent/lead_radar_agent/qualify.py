"""Qualification via le moteur TypeScript existant (scripts/radar-cli.ts).

Une seule logique de qualification pour le site et l'agent : pas de double
implémentation à maintenir.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

from .sources.base import RawItem

REPO_ROOT = Path(__file__).resolve().parents[2]


class QualifyError(Exception):
    pass


def qualify(items: list[RawItem], *, source_id: str, mode: str, now_iso: str, runner=subprocess.run) -> list[dict]:
    if not items:
        return []
    payload = json.dumps({"sourceId": source_id, "mode": mode, "now": now_iso, "items": [i.to_cli() for i in items]})
    tsx = REPO_ROOT / "node_modules" / ".bin" / "tsx"
    if not tsx.exists():
        raise QualifyError("tsx introuvable : lancer `npm ci` à la racine du dépôt.")
    proc = runner(
        [str(tsx), "scripts/radar-cli.ts"],
        input=payload,
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        timeout=180,
    )
    if proc.returncode != 0:
        # stderr ne contient que le message d'erreur du CLI, jamais le texte des items.
        raise QualifyError(f"échec du moteur de qualification : {proc.stderr.strip()[:300]}")
    results = json.loads(proc.stdout)["results"]
    if len(results) != len(items):
        raise QualifyError("réponse incohérente du moteur de qualification")
    return results
