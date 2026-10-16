"""Bluesky — recherche publique officielle (AppView api.bsky.app, sans compte).

Lecture seule. Les règles Bluesky considèrent les réponses automatisées non
sollicitées comme du spam : aucune publication n'est prévue.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from urllib.parse import urlencode

from ..http import HttpError, request_with_retry
from .base import RawItem, SourceResult

ENDPOINT = "https://api.bsky.app/xrpc/app.bsky.feed.searchPosts"
SOURCE_ID = "bluesky"


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def post_to_item(post: dict) -> RawItem | None:
    record = post.get("record") or {}
    text = record.get("text") or ""
    uri = post.get("uri") or ""
    handle = (post.get("author") or {}).get("handle")
    rkey = uri.rsplit("/", 1)[-1] if uri else None
    if not text or not uri:
        return None
    url = f"https://bsky.app/profile/{handle}/post/{rkey}" if handle and rkey else None
    return RawItem(SOURCE_ID, uri, url, "", text, _parse_dt(record.get("createdAt")) or _parse_dt(post.get("indexedAt")))


def search(queries: list[str], *, now: datetime, lookback_hours: int, limit: int = 25, **http_kwargs) -> SourceResult:
    result = SourceResult(SOURCE_ID)
    since = (now - timedelta(hours=lookback_hours)).strftime("%Y-%m-%dT%H:%M:%SZ")
    for q in queries:
        params = urlencode({"q": q, "lang": "fr", "sort": "latest", "since": since, "limit": limit})
        result.queries.append(q)
        try:
            data = request_with_retry(f"{ENDPOINT}?{params}", **http_kwargs).json()
        except HttpError as exc:
            result.errors.append(exc.code)
            continue
        for post in data.get("posts", []):
            item = post_to_item(post)
            if item:
                result.items.append(item)
    return result
