"""Envoi du passage au tableau de bord (route /api/radar/ingest du site).

N'envoie que des métriques et des opportunités de sources conservables (jamais
Brave). Un échec d'envoi n'empêche jamais les alertes e-mail.
"""

from __future__ import annotations

import json

from .http import HttpError, request_with_retry


def push(env: dict, report, **http_kwargs) -> str:
    url, token = env.get("RADAR_INGEST_URL"), env.get("RADAR_INGEST_TOKEN")
    if not url or not token:
        return "not_configured"
    record = report.record()
    record["sources"] = {k: {kk: v.get(kk) for kk in ("status", "sent", "results", "relevant", "cost_usd")} for k, v in record["sources"].items()}
    body = json.dumps({"run": record, "opportunities": [o for o in report.opportunities if o["source_id"] != "brave_search"]}).encode()
    try:
        request_with_retry(url, method="POST", data=body, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, **http_kwargs)
        return "ok"
    except HttpError as exc:
        return f"error:{exc.code}:{exc.status or ''}"
