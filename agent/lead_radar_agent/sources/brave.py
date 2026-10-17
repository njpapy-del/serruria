"""Brave Search API — connecteur isolé, DÉSACTIVÉ par défaut.

Conditions vérifiées le 2026-10-16 (api-dashboard.search.brave.com/terms-of-service) :
interdiction de « stocker, mettre en cache ou constituer une base de données des
résultats », sauf stockage transitoire nécessaire au fonctionnement. Ce
connecteur ne persiste donc aucun résultat : les éléments ne vivent que pendant
l'exécution (qualification + e-mail). Les empreintes de déduplication sont des
hachages irréversibles d'URL — point à faire confirmer par Brave avant activation.

Activation : enabled=true ET approved_by_owner=true dans config.json, clé
BRAVE_SEARCH_API_KEY, et budget mensuel > 0. Chaque appel est refusé AVANT
envoi si le budget serait dépassé.
"""

from __future__ import annotations

import html
import re
from datetime import datetime
from urllib.parse import urlencode

from ..http import HttpError, request_with_retry
from .base import RawItem, SourceDisabled, SourceNotConfigured, SourceResult

ENDPOINT = "https://api.search.brave.com/res/v1/web/search"
_TAGS = re.compile(r"<[^>]+>")


def _clean(text: str | None) -> str:
    """Les extraits Brave contiennent du HTML (<strong>, &#x27;…)."""
    return re.sub(r"\s+", " ", _TAGS.sub("", html.unescape(text or ""))).strip()
SOURCE_ID = "brave_search"


def check_enabled(cfg: dict, api_key: str | None) -> None:
    if not cfg.get("enabled"):
        raise SourceDisabled("source désactivée dans config.json")
    if not cfg.get("approved_by_owner"):
        raise SourceNotConfigured("accord du propriétaire requis (abonnement avec carte bancaire)")
    if not api_key:
        raise SourceNotConfigured("clé BRAVE_SEARCH_API_KEY absente")
    if float(cfg.get("monthly_budget_usd", 0)) <= 0:
        raise SourceNotConfigured("budget mensuel à 0")


def search(
    queries: list[str], *, api_key: str, budget_left_usd: float, cost_per_query: float, freshness: str = "pw", **http_kwargs
) -> SourceResult:
    result = SourceResult(SOURCE_ID)
    for q in queries:
        if budget_left_usd - cost_per_query * (result.paid_requests + 1) < 0:
            result.skipped_reason = "budget mensuel atteint"
            break
        params = urlencode({"q": q, "country": "FR", "search_lang": "fr", "freshness": freshness, "count": 20})
        result.queries.append(q)
        # Compté AVANT l'appel : en cas de doute, on surestime la dépense.
        result.paid_requests += 1
        try:
            res = request_with_retry(
                f"{ENDPOINT}?{params}",
                headers={"Accept": "application/json", "X-Subscription-Token": api_key},
                attempts=1,
                **http_kwargs,
            )
        except HttpError as exc:
            result.errors.append(exc.code)
            if exc.code == "quota":
                break
            continue
        for r in (res.json().get("web") or {}).get("results", []):
            published = None
            if r.get("page_age"):
                try:
                    published = datetime.fromisoformat(str(r["page_age"]).replace("Z", "+00:00"))
                except ValueError:
                    published = None
            result.items.append(RawItem(SOURCE_ID, None, r.get("url"), _clean(r.get("title")), _clean(r.get("description")), published))
    return result
