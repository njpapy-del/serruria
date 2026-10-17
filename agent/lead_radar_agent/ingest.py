"""Envoi du passage au tableau de bord (route /api/radar/ingest du site).

N'envoie que des métriques et des opportunités de sources conservables (jamais
Brave). Un échec d'envoi n'empêche jamais les alertes e-mail : le passage est
mis en file et renvoyé aux passages suivants (50 au maximum).
- Les métriques sont toujours mises en file (aucune donnée personnelle).
- Les opportunités (liens publics) ne sont mises en file que si l'état est
  stocké en privé (RADAR_PRIVATE_STATE=true, cas du serveur) : jamais dans le
  cache d'un dépôt public.
"""

from __future__ import annotations

import json

from .http import HttpError, request_with_retry

MAX_QUEUE = 50


def payload(report) -> dict:
    record = report.record()
    record["sources"] = {
        k: {kk: v.get(kk) for kk in ("status", "planned", "sent", "succeeded", "failed", "results", "relevant", "duplicates",
                                    "eliminated", "cost_usd", "queries", "duration_ms", "error_kind", "error_codes", "reason", "lieux_couverts")}
        for k, v in record["sources"].items()
    }
    return {"run": record, "opportunities": [o for o in report.opportunities if o["source_id"] != "brave_search"]}


def _send(url: str, token: str, body: dict, **http_kwargs) -> None:
    request_with_retry(url, method="POST", data=json.dumps(body).encode(),
                       headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, **http_kwargs)


def push(env: dict, report, state=None, **http_kwargs) -> str:
    url, token = env.get("RADAR_INGEST_URL"), env.get("RADAR_INGEST_TOKEN")
    if not url or not token:
        return "not_configured"
    private = env.get("RADAR_PRIVATE_STATE") == "true"
    queue = state.data.setdefault("ingest_queue", []) if state is not None else []
    body = payload(report)
    pending = [*queue, body]
    sent = 0
    status = "ok"
    for item in list(pending):
        try:
            _send(url, token, item, **http_kwargs)
            pending.remove(item)
            sent += 1
        except HttpError as exc:
            status = f"error:{exc.code}:{exc.status or ''}"
            break
    if state is not None:
        kept = [{"run": p["run"], "opportunities": p["opportunities"] if private else []} for p in pending]
        state.data["ingest_queue"] = kept[-MAX_QUEUE:]
    return status if status != "ok" else f"ok:{sent}"
