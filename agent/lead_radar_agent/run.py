"""Exécution d'un passage du Lead Radar.

Journaux : compteurs et codes d'erreur UNIQUEMENT (les journaux GitHub
Actions d'un dépôt public sont publics). Les URL et textes des prospects ne
partent que dans l'e-mail envoyé à l'entreprise.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, time as dtime
from pathlib import Path
from zoneinfo import ZoneInfo

from . import queries as Q
from .notify import Mailer, NotifyError, lead_body, lead_subject
from .qualify import QualifyError, qualify
from .sources import bluesky, brave, rss
from .sources.base import RawItem, SourceDisabled, SourceResult
from .state import State

LEAD_CLASSES_DEFAULT = ("DEMANDE_CONFIRMEE", "DEMANDE_PROBABLE")
SOURCE_NAMES = {"bluesky": "Bluesky (recherche publique)", "alertes_rss": "Alertes web (RSS)", "brave_search": "Brave Search API"}


@dataclass
class Report:
    mode: str
    started_at: str
    sources: dict[str, dict] = field(default_factory=dict)
    analysed: int = 0
    duplicates: int = 0
    by_class: dict[str, int] = field(default_factory=dict)
    notifications_sent: int = 0
    notification_errors: list[str] = field(default_factory=list)
    summary_sent: bool = False
    outside_hours: bool = False

    @property
    def search_failed(self) -> bool:
        """Vrai si au moins une source a rencontré une erreur de recherche."""
        return any(s.get("errors") for s in self.sources.values())

    def public_log(self) -> str:
        """Résumé publiable dans un journal public : aucun contenu, aucune URL."""
        return json.dumps(
            {
                "mode": self.mode,
                "started_at": self.started_at,
                "outside_hours": self.outside_hours,
                "sources": self.sources,
                "analysed": self.analysed,
                "duplicates": self.duplicates,
                "by_class": self.by_class,
                "notifications_sent": self.notifications_sent,
                "notification_errors": self.notification_errors,
                "daily_summary_sent": self.summary_sent,
            },
            ensure_ascii=False,
            sort_keys=True,
        )


def _in_hours(cfg: dict, local_now: datetime) -> bool:
    h = cfg.get("surveillance_hours") or {}
    start = dtime.fromisoformat(h.get("start", "00:00"))
    end = dtime.fromisoformat(h.get("end", "23:59"))
    t = local_now.time()
    return start <= t <= end if start <= end else (t >= start or t <= end)


def _interval_ok(state: State, source_id: str, now: datetime, minutes: int) -> bool:
    last = state.source(source_id).get("last_run")
    return not last or (now - datetime.fromisoformat(last)).total_seconds() >= minutes * 60 - 30


def collect(source_id: str, scfg: dict, cfg: dict, state: State, env: dict, now: datetime, http_kwargs: dict) -> SourceResult:
    today = now.date().isoformat()
    if source_id == "bluesky":
        left = int(scfg.get("max_queries_per_day", 0)) - state.queries_today(source_id, today)
        all_q = Q.broad_queries()
        batch, cursor = Q.next_batch(all_q, state.data["query_cursor"].get(source_id, 0), min(int(scfg.get("max_queries_per_run", 0)), left))
        if not batch:
            return SourceResult(source_id, skipped_reason="quota quotidien de requêtes atteint")
        res = bluesky.search(batch, now=now, lookback_hours=int(scfg.get("lookback_hours", 6)), **http_kwargs)
        state.data["query_cursor"][source_id] = cursor
        state.add_queries(source_id, today, len(res.queries))
        return res

    if source_id == "alertes_rss":
        feeds = [u.strip() for u in (env.get("RADAR_RSS_FEEDS") or "").split(",") if u.strip()]
        if not feeds:
            return SourceResult(source_id, skipped_reason="aucun flux configuré (RADAR_RSS_FEEDS)")
        return rss.read_feeds(feeds[: int(scfg.get("max_feeds_per_run", 20))], **http_kwargs)

    if source_id == "brave_search":
        brave.check_enabled(scfg, env.get("BRAVE_SEARCH_API_KEY"))
        month = now.strftime("%Y-%m")
        budget_left = float(scfg["monthly_budget_usd"]) - state.spend(month)
        left = int(scfg.get("max_queries_per_day", 0)) - state.queries_today(source_id, today)
        all_q = Q.localized_queries(cfg.get("departements", []), cfg.get("communes_prioritaires", []))
        batch, cursor = Q.next_batch(all_q, state.data["query_cursor"].get(source_id, 0), min(int(scfg.get("max_queries_per_run", 0)), left))
        if not batch:
            return SourceResult(source_id, skipped_reason="quota quotidien de requêtes atteint")
        res = brave.search(batch, api_key=env["BRAVE_SEARCH_API_KEY"], budget_left_usd=budget_left, cost_per_query=float(scfg["cost_per_query_usd"]), **http_kwargs)
        state.add_spend(month, res.paid_requests * float(scfg["cost_per_query_usd"]))
        state.data["query_cursor"][source_id] = cursor
        state.add_queries(source_id, today, len(res.queries))
        return res

    raise SourceDisabled("source inconnue")


def run_once(
    *,
    mode: str,
    cfg: dict,
    state: State,
    env: dict,
    now: datetime,
    mailer: Mailer | None,
    collected: dict[str, SourceResult] | None = None,
    http_kwargs: dict | None = None,
    qualify_fn=qualify,
) -> Report:
    """Un passage complet. `collected` permet le mode test (aucun appel réseau)."""
    if mode not in ("surveillance", "assiste", "test"):
        raise ValueError("mode non autorisé (la publication automatique n'est pas disponible)")
    http_kwargs = http_kwargs or {}
    tz = ZoneInfo(cfg.get("timezone", "Europe/Paris"))
    local_now = now.astimezone(tz)
    today = local_now.date().isoformat()
    daily = state.daily(today)
    daily["runs"] += 1
    report = Report(mode=mode, started_at=now.isoformat())
    engine_mode = "assiste" if mode in ("assiste", "test") else "surveillance"

    # 1. Collecte
    results: dict[str, SourceResult] = {}
    if collected is not None:
        results = collected
    elif not _in_hours(cfg, local_now):
        report.outside_hours = True
    else:
        for sid, scfg in cfg.get("sources", {}).items():
            if not scfg.get("enabled"):
                report.sources[sid] = {"status": "disabled"}
                continue
            if not _interval_ok(state, sid, now, int(scfg.get("min_interval_minutes", 30))):
                report.sources[sid] = {"status": "skipped", "reason": "intervalle minimal non écoulé"}
                continue
            try:
                results[sid] = collect(sid, scfg, cfg, state, env, now, http_kwargs)
            except SourceDisabled as exc:
                report.sources[sid] = {"status": "disabled", "reason": str(exc)}

    # 2. Qualification + déduplication
    to_notify: list[tuple[dict, RawItem, str]] = []
    for sid, res in results.items():
        entry = {"status": "ok", "queries": len(res.queries), "items": len(res.items), "errors": res.errors}
        if res.skipped_reason:
            entry.update(status="skipped", reason=res.skipped_reason)
        if res.paid_requests:
            entry["paid_requests"] = res.paid_requests
        report.sources[sid] = entry
        daily["queries"] += len(res.queries)
        if res.queries:
            daily["sources"] += 1
        if res.errors:
            daily["errors"] += len(res.errors)
            entry["status"] = "error" if not res.items else "partial"
            state.record_error(sid, now, res.errors[-1])
        elif not res.skipped_reason:
            state.record_success(sid, now)

        # Doublons évidents entre requêtes d'un même passage (même identifiant).
        unique: dict[str, RawItem] = {}
        for it in res.items:
            unique.setdefault(it.external_id or it.url or f"{it.title}{it.content}", it)
        items = list(unique.values())
        report.duplicates += len(res.items) - len(items)
        if not items:
            continue
        try:
            qualified = qualify_fn(items, source_id=sid, mode=engine_mode, now_iso=now.isoformat())
        except QualifyError as exc:
            entry["status"] = "error"
            entry["errors"] = [*entry["errors"], "qualification"]
            report.notification_errors.append(str(exc)[:200])
            continue

        for item, r in zip(items, qualified):
            report.analysed += 1
            daily["items"] += 1
            if state.find_seen(r["dedupeKeys"]):
                report.duplicates += 1
                continue
            state.remember(r["dedupeKeys"], now)
            report.by_class[r["classe"]] = report.by_class.get(r["classe"], 0) + 1
            if r["classe"] in LEAD_CLASSES_DEFAULT:
                daily["demandes"] += 1
            if r["classe"] in cfg.get("notify_classes", LEAD_CLASSES_DEFAULT) and r["score"] >= int(cfg.get("notify_min_score", 0)):
                to_notify.append((r, item, sid))

    # 3. Notifications (urgentes : une par prospect ; autres : regroupées)
    detected_at = local_now.strftime("%Y-%m-%d %H:%M (%Z)")
    pending = [(r, it, sid) for r, it, sid in to_notify if not state.was_notified(r["dedupeKeys"][0])]
    if pending and mailer is None and mode != "test":
        report.notification_errors.append("notifications non configurées (RESEND_API_KEY / LEAD_RADAR_*)")
    if mailer is not None:
        urgent = [p for p in pending if p[0].get("urgente")]
        normal = [p for p in pending if not p[0].get("urgente")]
        for r, it, sid in urgent:
            try:
                mailer.send(lead_subject(r), lead_body(r, it, source_nom=SOURCE_NAMES.get(sid, sid), detected_at=detected_at, with_response=mode != "surveillance"), f"lead-{r['dedupeKeys'][0]}")
                state.mark_notified(r["dedupeKeys"][0], now)
                report.notifications_sent += 1
            except NotifyError as exc:
                report.notification_errors.append(str(exc))
        max_batch = int(cfg.get("max_items_per_email_batch", 10))
        for i in range(0, len(normal), max_batch):
            chunk = normal[i : i + max_batch]
            subject = f"[LEAD RADAR] {len(chunk)} demande(s) à examiner"
            body = "\n\n────────────\n\n".join(
                f"{lead_subject(r)}\n\n" + lead_body(r, it, source_nom=SOURCE_NAMES.get(sid, sid), detected_at=detected_at, with_response=mode != "surveillance")
                for r, it, sid in chunk
            )
            key = "batch-" + "-".join(r["dedupeKeys"][0][-12:] for r, _, _ in chunk)
            try:
                mailer.send(subject, body, key)
                for r, _, _ in chunk:
                    state.mark_notified(r["dedupeKeys"][0], now)
                report.notifications_sent += len(chunk)
            except NotifyError as exc:
                report.notification_errors.append(str(exc))
    daily["notifications"] += report.notifications_sent

    # 4. Alertes de panne : 3 échecs consécutifs → une alerte par jour et par source
    if mailer is not None:
        for sid, s in state.data["sources"].items():
            if s.get("consecutive_errors", 0) >= 3 and state.data["error_alerts"].get(sid) != today:
                try:
                    mailer.send(
                        f"[LEAD RADAR] [ERREUR] Source « {SOURCE_NAMES.get(sid, sid)} » en échec",
                        f"La source {SOURCE_NAMES.get(sid, sid)} a échoué {s['consecutive_errors']} fois de suite.\n"
                        f"Dernier code d'erreur : {s.get('last_error_code')}\nDernier succès : {s.get('last_success') or 'jamais'}\n\n"
                        "Ces passages sont comptés comme des ERREURS, pas comme des recherches sans résultat.",
                        f"error-{sid}-{today}",
                    )
                    state.data["error_alerts"][sid] = today
                except NotifyError as exc:
                    report.notification_errors.append(str(exc))

    # 5. Synthèse quotidienne
    if mailer is not None and local_now.hour >= int(cfg.get("daily_summary_hour", 20)) and state.data["last_summary_date"] != today:
        d = state.daily(today)
        sources_txt = "\n".join(
            f"  - {SOURCE_NAMES.get(sid, sid)} : dernier succès {s.get('last_success') or 'jamais'}, erreurs consécutives {s.get('consecutive_errors', 0)}"
            for sid, s in state.data["sources"].items()
        )
        try:
            mailer.send(
                f"[LEAD RADAR] Synthèse du {today}",
                f"Passages : {d['runs']}\nRecherches effectuées : {d['queries']}\nConsultations de sources : {d['sources']}\n"
                f"Éléments analysés : {d['items']}\nDemandes détectées (confirmées ou probables) : {d['demandes']}\n"
                f"Notifications envoyées : {d['notifications']}\nErreurs de recherche : {d['errors']}\n\nÉtat des sources :\n{sources_txt}\n\n"
                "Une erreur de recherche n'est jamais comptée comme une recherche sans résultat.",
                f"summary-{today}",
            )
            state.data["last_summary_date"] = today
            report.summary_sent = True
        except NotifyError as exc:
            report.notification_errors.append(str(exc))

    state.purge(now, int(cfg.get("retention_days", 60)))
    return report


def load_config(path: Path) -> dict:
    return json.loads(path.read_text("utf-8"))
