"""Contrat commun des connecteurs."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class RawItem:
    """Élément brut, au format attendu par le moteur TypeScript (scripts/radar-cli.ts)."""

    source_id: str
    external_id: str | None
    url: str | None
    title: str
    content: str
    published_at: datetime | None

    def to_cli(self) -> dict:
        return {
            "sourceId": self.source_id,
            "externalId": self.external_id,
            "url": self.url,
            "title": self.title,
            "content": self.content,
            "publishedAt": self.published_at.isoformat() if self.published_at else None,
        }


@dataclass
class SourceResult:
    source_id: str
    queries: list[str] = field(default_factory=list)
    items: list[RawItem] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    """Codes d'erreur (jamais de contenu) : network, timeout, http, quota, parse…"""
    skipped_reason: str | None = None
    paid_requests: int = 0


class SourceDisabled(Exception):
    """La source ne peut pas tourner (désactivée, accord manquant, clé absente)."""
