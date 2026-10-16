"""Flux RSS/Atom d'alertes fournis par l'entreprise (Google Alerts, Talkwalker).

Lecture seule. Les URL des flux viennent de la variable RADAR_RSS_FEEDS.
"""

from __future__ import annotations

import html
import re
from datetime import datetime
from email.utils import parsedate_to_datetime
from urllib.parse import parse_qs, urlsplit
import xml.etree.ElementTree as ET

from ..http import HttpError, request_with_retry
from .base import RawItem, SourceResult

SOURCE_ID = "alertes_rss"
ATOM = "{http://www.w3.org/2005/Atom}"
TAG_RE = re.compile(r"<[^>]+>")


def _clean(s: str | None) -> str:
    return re.sub(r"\s+", " ", TAG_RE.sub(" ", html.unescape(s or ""))).strip()


def _date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        try:
            return parsedate_to_datetime(value)
        except (TypeError, ValueError):
            return None


def unwrap_google(url: str | None) -> str | None:
    if not url:
        return url
    parts = urlsplit(url)
    if parts.netloc.endswith("google.com") and parts.path == "/url":
        target = parse_qs(parts.query).get("url") or parse_qs(parts.query).get("q")
        if target:
            return target[0]
    return url


def parse_feed(xml_text: str) -> list[RawItem]:
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as exc:
        raise HttpError("Flux illisible.", "parse") from exc
    items: list[RawItem] = []
    for entry in root.iter(f"{ATOM}entry"):
        link = entry.find(f"{ATOM}link")
        items.append(RawItem(
            SOURCE_ID,
            (entry.findtext(f"{ATOM}id") or "").strip() or None,
            unwrap_google(link.get("href") if link is not None else None),
            _clean(entry.findtext(f"{ATOM}title")),
            _clean(entry.findtext(f"{ATOM}content") or entry.findtext(f"{ATOM}summary")),
            _date(entry.findtext(f"{ATOM}published") or entry.findtext(f"{ATOM}updated")),
        ))
    for it in root.iter("item"):
        items.append(RawItem(
            SOURCE_ID,
            (it.findtext("guid") or "").strip() or None,
            unwrap_google((it.findtext("link") or "").strip() or None),
            _clean(it.findtext("title")),
            _clean(it.findtext("description")),
            _date(it.findtext("pubDate")),
        ))
    if not items and root.tag not in ("rss", f"{ATOM}feed"):
        raise HttpError("Le document n'est pas un flux RSS/Atom.", "parse")
    return items


def read_feeds(feed_urls: list[str], **http_kwargs) -> SourceResult:
    result = SourceResult(SOURCE_ID)
    for url in feed_urls:
        result.queries.append("flux RSS")  # l'URL du flux n'est jamais journalisée
        try:
            result.items += parse_feed(request_with_retry(url, **http_kwargs).text())
        except HttpError as exc:
            result.errors.append(exc.code)
    return result
