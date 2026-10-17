"""État persistant de l'agent, SANS donnée personnelle.

Ne contient que des empreintes SHA-256 des clés de déduplication, des compteurs
et la santé des sources. Il peut donc être conservé dans le cache GitHub
Actions d'un dépôt public sans exposer de prospect.
"""

from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

VERSION = 1


def digest(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:32]


def _empty() -> dict[str, Any]:
    return {
        "version": VERSION,
        "seen": {},
        "notified": {},
        "daily": {},
        "spend": {"month": None, "usd": 0.0},
        "sources": {},
        "query_cursor": {},
        "last_summary_date": None,
        "error_alerts": {},
        "runs": [],
        "coverage": {},
    }


class State:
    def __init__(self, path: Path, data: dict[str, Any] | None = None):
        self.path = path
        self.data = data or _empty()

    @classmethod
    def load(cls, path: Path) -> "State":
        if path.exists():
            try:
                data = json.loads(path.read_text("utf-8"))
                if data.get("version") == VERSION:
                    base = _empty()
                    base.update(data)
                    return cls(path, base)
            except ValueError:
                pass  # état corrompu : on repart d'un état vide plutôt que d'échouer
        return cls(path)

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.data, ensure_ascii=False, sort_keys=True), "utf-8")
        os.replace(tmp, self.path)

    # ── Déduplication ────────────────────────────────────────────────
    def find_seen(self, keys: list[str]) -> str | None:
        for key in keys:
            if digest(key) in self.data["seen"]:
                return key
        return None

    def remember(self, keys: list[str], now: datetime) -> None:
        for key in keys:
            self.data["seen"].setdefault(digest(key), now.isoformat())

    def was_notified(self, key: str) -> bool:
        return digest(key) in self.data["notified"]

    def mark_notified(self, key: str, now: datetime) -> None:
        self.data["notified"][digest(key)] = now.isoformat()

    def purge(self, now: datetime, retention_days: int) -> int:
        limit = now - timedelta(days=retention_days)
        removed = 0
        for bucket in ("seen", "notified"):
            for h, ts in list(self.data[bucket].items()):
                if datetime.fromisoformat(ts) < limit:
                    del self.data[bucket][h]
                    removed += 1
        return removed

    # ── Compteurs du jour ────────────────────────────────────────────
    def daily(self, today: str) -> dict[str, int]:
        d = self.data["daily"]
        if d.get("date") != today:
            self.data["daily"] = d = {
                "date": today, "runs": 0, "queries": 0, "sources": 0, "items": 0,
                "demandes": 0, "notifications": 0, "errors": 0,
            }
        return d

    def queries_today(self, source_id: str, today: str) -> int:
        q = self.data["sources"].setdefault(source_id, {}).get("queries", {})
        return q.get("count", 0) if q.get("date") == today else 0

    def add_queries(self, source_id: str, today: str, n: int) -> None:
        s = self.data["sources"].setdefault(source_id, {})
        q = s.get("queries", {})
        s["queries"] = {"date": today, "count": (q.get("count", 0) if q.get("date") == today else 0) + n}

    # ── Budget (sources payantes) ────────────────────────────────────
    def spend(self, month: str) -> float:
        sp = self.data["spend"]
        if sp.get("month") != month:
            self.data["spend"] = sp = {"month": month, "usd": 0.0}
        return float(sp["usd"])

    def add_spend(self, month: str, usd: float) -> None:
        self.spend(month)
        self.data["spend"]["usd"] = round(self.data["spend"]["usd"] + usd, 6)

    # ── Santé des sources ────────────────────────────────────────────
    def source(self, source_id: str) -> dict[str, Any]:
        return self.data["sources"].setdefault(source_id, {})

    def record_success(self, source_id: str, now: datetime) -> None:
        s = self.source(source_id)
        s.update({"last_run": now.isoformat(), "last_success": now.isoformat(), "consecutive_errors": 0, "last_error_code": None})

    def record_error(self, source_id: str, now: datetime, code: str) -> None:
        s = self.source(source_id)
        s.update({"last_run": now.isoformat(), "last_error_code": code, "consecutive_errors": s.get("consecutive_errors", 0) + 1})

    # ── Journal des passages (métriques uniquement) ──────────────────
    def add_run(self, record: dict, keep: int = 500) -> None:
        self.data["runs"].append(record)
        del self.data["runs"][:-keep]

    def mark_covered(self, source_id: str, lieux: list[str], now: datetime) -> None:
        cov = self.data["coverage"].setdefault(source_id, {})
        for lieu in lieux:
            cov[lieu] = now.date().isoformat()

    def coverage_count(self, source_id: str) -> int:
        return len(self.data["coverage"].get(source_id, {}))
