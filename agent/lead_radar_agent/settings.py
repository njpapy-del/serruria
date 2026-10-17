"""Réglages modifiables depuis l'administration du site.

Le robot les lit au début de chaque passage (GET /api/radar/settings, jeton
Bearer). Si le site ou la base est indisponible, il utilise config.json (repli
local) et le journalise. Toutes les valeurs sont revalidées ici.
"""

from __future__ import annotations

import copy

from .http import HttpError, request

DEPTS = {"75", "77", "78", "91", "92", "93", "94", "95"}
CLASSES = {"DEMANDE_CONFIRMEE", "DEMANDE_PROBABLE", "DEMANDE_DEVIS", "RECHERCHE_PRO"}


def _int(v, lo, hi):
    return v if isinstance(v, int) and not isinstance(v, bool) and lo <= v <= hi else None


def apply_settings(cfg: dict, remote: dict) -> tuple[dict, list[str]]:
    """Applique les réglages valides ; renvoie (config, réglages ignorés)."""
    out = copy.deepcopy(cfg)
    ignored: list[str] = []
    srcs = out.setdefault("sources", {})
    for sid, val in (remote.get("sources_enabled") or {}).items():
        if sid in srcs and isinstance(val, bool):
            srcs[sid]["enabled"] = val
        else:
            ignored.append(f"sources_enabled.{sid}")
    checks = [
        ("bluesky_min_interval_minutes", ("bluesky", "min_interval_minutes"), 10, 1440),
        ("brave_max_queries_per_run", ("brave_search", "max_queries_per_run"), 0, 6),
        ("brave_max_queries_per_day", ("brave_search", "max_queries_per_day"), 0, 24),
        ("brave_rayon_prioritaire_km", ("brave_search", "rayon_prioritaire_km"), 1, 50),
    ]
    for key, (sid, field), lo, hi in checks:
        if key in remote:
            v = _int(remote[key], lo, hi)
            if v is None or sid not in srcs:
                ignored.append(key)
            else:
                srcs[sid][field] = v
    if "departements" in remote:
        d = remote["departements"]
        if isinstance(d, list) and d and all(x in DEPTS for x in d):
            out["departements"] = sorted(set(d))
        else:
            ignored.append("departements")
    if "notify_min_score" in remote:
        v = _int(remote["notify_min_score"], 0, 100)
        if v is None:
            ignored.append("notify_min_score")
        else:
            out["notify_min_score"] = v
    if "notify_classes" in remote:
        c = remote["notify_classes"]
        if isinstance(c, list) and all(x in CLASSES for x in c):
            out["notify_classes"] = c
        else:
            ignored.append("notify_classes")
    if "alerts_enabled" in remote:
        if isinstance(remote["alerts_enabled"], bool):
            out["alerts_enabled"] = remote["alerts_enabled"]
        else:
            ignored.append("alerts_enabled")
    if "extra_keywords" in remote:
        k = remote["extra_keywords"]
        if isinstance(k, list) and len(k) <= 20 and all(isinstance(x, str) and 2 <= len(x) <= 60 for x in k):
            out["extra_keywords"] = [x.strip() for x in k]
        else:
            ignored.append("extra_keywords")
    return out, ignored


def load_remote(cfg: dict, env: dict, **http_kwargs) -> tuple[dict, str]:
    """Renvoie (config effective, origine) ; origine = 'site' ou 'local:<raison>'."""
    url = env.get("RADAR_SETTINGS_URL") or (env.get("RADAR_INGEST_URL") or "").replace("/api/radar/ingest", "/api/radar/settings")
    token = env.get("RADAR_INGEST_TOKEN")
    if not url or not token:
        return cfg, "local:non_configure"
    try:
        res = request(url, headers={"Authorization": f"Bearer {token}"}, timeout=10, **http_kwargs)
        data = res.json()
    except HttpError as exc:
        return cfg, f"local:site_indisponible:{exc.code}:{exc.status or ''}"
    if not isinstance(data, dict) or not isinstance(data.get("settings"), dict):
        return cfg, "local:reponse_invalide"
    merged, ignored = apply_settings(cfg, data["settings"])
    return merged, "site" + (f" (ignorés : {', '.join(ignored)})" if ignored else "")
