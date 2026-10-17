"""Exécution d'un passage du Lead Radar.

Journaux : métriques, textes de requêtes et codes d'erreur UNIQUEMENT. Aucune
URL ni aucun texte de publication n'y figure (les journaux GitHub Actions d'un
dépôt public sont publics). Les prospects ne partent que dans l'e-mail envoyé à
l'entreprise.
"""

from __future__ import annotations

import json
import statistics
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, time as dtime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from . import queries as Q
from .notify import Mailer, NotifyError, lead_body, lead_subject
from .qualify import QualifyError, qualify
from .sources import bluesky, brave, rss
from .sources.base import RawItem, SourceDisabled, SourceNotConfigured, SourceResult
from .state import State

_clock = time.monotonic

LEAD_CLASSES_DEFAULT = ("DEMANDE_CONFIRMEE", "DEMANDE_PROBABLE", "DEMANDE_DEVIS", "RECHERCHE_PRO")
SOURCE_NAMES = {"bluesky": "Bluesky (API publique officielle)", "alertes_rss": "Alertes web (RSS)", "brave_search": "Brave Search API"}
CRON_MINUTE_UTC = 7  # doit correspondre à .github/workflows/lead-radar.yml (si GitHub Actions est utilisé)

# Statuts (par source et par passage). Jamais confondus :
#  SUCCESS_NO_RELEVANT_LEADS = recherche faite, résultats non pertinents ;
#  SOURCE_NOT_RUN            = aucune recherche faite.
STATUS_LABELS = {
    "SUCCESS_WITH_LEADS": "recherche faite, demandes pertinentes trouvées",
    "SUCCESS_NO_RELEVANT_LEADS": "recherche faite, résultats obtenus mais aucun pertinent",
    "SUCCESS_NO_RESULTS": "recherche faite, aucun résultat",
    "PARTIAL_SUCCESS": "recherche partiellement réussie (au moins une requête en échec)",
    "SEARCH_FAILED": "recherche échouée (toutes les requêtes en échec)",
    "SOURCE_NOT_CONFIGURED": "source non configurée (clé, flux ou accord manquant)",
    "SOURCE_NOT_RUN": "aucune recherche faite (désactivée, hors créneau ou intervalle)",
    "EMAIL_FAILED": "au moins une alerte n'a pas pu être envoyée",
}


@dataclass
class Report:
    mode: str
    started_at: str
    run_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    local_start: str | None = None
    finished_at: str | None = None
    sources: dict[str, dict] = field(default_factory=dict)
    analysed: int = 0
    duplicates: int = 0
    by_class: dict[str, int] = field(default_factory=dict)
    by_metier: dict[str, dict[str, int]] = field(default_factory=dict)
    notifications_sent: int = 0
    notification_errors: list[str] = field(default_factory=list)
    notif: dict[str, int] = field(default_factory=lambda: {"generated": 0, "accepted": 0, "refused": 0, "temporary": 0, "permanent": 0, "blocked": 0})
    delivery: dict[str, int] = field(default_factory=dict)
    status: str | None = None
    summary_sent: bool = False
    outside_hours: bool = False
    notification_impossible: bool = False
    config_source: str = "local"
    # Opportunités conservables (jamais Brave) pour le tableau de bord ; hors journal public.
    opportunities: list[dict] = field(default_factory=list)

    @property
    def health(self) -> str | None:  # compatibilité
        return self.status

    @property
    def search_failed(self) -> bool:
        return any(s.get("status") in ("SEARCH_FAILED", "PARTIAL_SUCCESS") for s in self.sources.values())

    def record(self) -> dict:
        """Enregistrement du passage : métriques uniquement (aucune URL, aucun texte publié)."""
        return {
            "run_id": self.run_id,
            "mode": self.mode,
            "started_at_utc": self.started_at,
            "started_at_paris": self.local_start,
            "finished_at_utc": self.finished_at,
            "status": self.status,
            "sources": self.sources,
            "analysed": self.analysed,
            "duplicates": self.duplicates,
            "by_class": self.by_class,
            "by_metier": self.by_metier,
            "alerts": self.notif,
            "delivery": self.delivery,
            "notification_errors": self.notification_errors,
            "daily_summary_sent": self.summary_sent,
            "config_source": self.config_source,
        }

    def public_log(self) -> str:
        return json.dumps(self.record(), ensure_ascii=False, sort_keys=True)


def _in_hours(cfg: dict, local_now: datetime) -> bool:
    h = cfg.get("surveillance_hours") or {}
    start = dtime.fromisoformat(h.get("start", "00:00"))
    end = dtime.fromisoformat(h.get("end", "23:59"))
    t = local_now.time()
    return start <= t <= end if start <= end else (t >= start or t <= end)


def _in_window(window: dict | None, local_now: datetime) -> bool:
    if not window:
        return True
    return _in_hours({"surveillance_hours": window}, local_now)


def _interval_ok(state: State, source_id: str, now: datetime, minutes: int) -> bool:
    last = state.source(source_id).get("last_run")
    return not last or (now - datetime.fromisoformat(last)).total_seconds() >= minutes * 60 - 30


def collect(source_id: str, scfg: dict, cfg: dict, state: State, env: dict, now: datetime, http_kwargs: dict) -> SourceResult:
    today = now.date().isoformat()
    if source_id == "bluesky":
        left = int(scfg.get("max_queries_per_day", 0)) - state.queries_today(source_id, today)
        all_q = Q.broad_queries(include_plomberie=cfg.get("metiers", {}).get("plomberie_recherche", True))
        planned = min(int(scfg.get("max_queries_per_run", 0)), left)
        batch, cursor = Q.next_batch(all_q, state.data["query_cursor"].get(source_id, 0), planned)
        if not batch:
            raise SourceDisabled("quota quotidien de requêtes atteint")
        res = bluesky.search(batch, now=now, lookback_hours=int(scfg.get("lookback_hours", 6)), **http_kwargs)
        res.planned = planned
        res.lieux = ["Île-de-France (filtrage après recherche)"]
        state.data["query_cursor"][source_id] = cursor
        state.add_queries(source_id, today, len(res.queries))
        return res

    if source_id == "alertes_rss":
        feeds = [u.strip() for u in (env.get("RADAR_RSS_FEEDS") or "").split(",") if u.strip()]
        if not feeds:
            raise SourceNotConfigured("aucun flux configuré (RADAR_RSS_FEEDS)")
        res = rss.read_feeds(feeds[: int(scfg.get("max_feeds_per_run", 20))], **http_kwargs)
        res.planned = min(len(feeds), int(scfg.get("max_feeds_per_run", 20)))
        return res

    if source_id == "brave_search":
        brave.check_enabled(scfg, env.get("BRAVE_SEARCH_API_KEY"))
        # Dépense bornée sans dépendre de l'état (qui peut être perdu) : passages
        # planifiés uniquement, dans des créneaux fixes.
        if scfg.get("scheduled_only") and env.get("RADAR_ALLOW_PAID") != "true":
            raise SourceDisabled("source payante : réservée aux passages planifiés")
        local = now.astimezone(ZoneInfo(cfg.get("timezone", "Europe/Paris")))
        slots = scfg.get("run_slots") or ([scfg["run_window"]] if scfg.get("run_window") else [])
        if slots and not any(_in_window(w, local) for w in slots):
            raise SourceDisabled("hors des créneaux Brave")
        month = now.strftime("%Y-%m")
        budget_left = float(scfg["monthly_budget_usd"]) - state.spend(month)
        left = int(scfg.get("max_queries_per_day", 0)) - state.queries_today(source_id, today)
        planned = min(int(scfg.get("max_queries_per_run", 0)), left)
        if planned <= 0:
            raise SourceDisabled("quota quotidien de requêtes atteint")
        # Moitié anneau prioritaire (départements + communes proches), moitié anneau large.
        prioritaire, large = Q.geo_rings(cfg.get("departements", []), rayon_prioritaire_km=float(scfg.get("rayon_prioritaire_km", 8)))
        cur = state.data["query_cursor"].setdefault("brave_geo", {"p": 0, "w": 0})
        n_p = (planned + 1) // 2
        pairs_p, cur["p"] = Q.lieu_queries(prioritaire, cur["p"], n_p)
        pairs_w, cur["w"] = Q.lieu_queries(large, cur["w"], planned - n_p)
        pairs = pairs_p + pairs_w
        res = brave.search(
            [q for q, _ in pairs],
            api_key=env["BRAVE_SEARCH_API_KEY"],
            budget_left_usd=budget_left,
            cost_per_query=float(scfg["cost_per_query_usd"]),
            freshness=scfg.get("freshness", "pw"),
            **http_kwargs,
        )
        res.planned = planned
        res.lieux = [lieu for q, lieu in pairs if q in res.queries]
        state.add_spend(month, res.paid_requests * float(scfg["cost_per_query_usd"]))
        state.add_queries(source_id, today, len(res.queries))
        state.mark_covered(source_id, res.lieux, now)
        return res

    raise SourceDisabled("source inconnue")


def _source_status(entry: dict) -> str:
    if entry["sent"] == 0:
        return "SOURCE_NOT_RUN"
    if entry["failed"] >= entry["sent"]:
        return "SEARCH_FAILED"
    if entry["failed"] > 0:
        return "PARTIAL_SUCCESS"
    if entry["results"] == 0:
        return "SUCCESS_NO_RESULTS"
    return "SUCCESS_WITH_LEADS" if entry["relevant"] > 0 else "SUCCESS_NO_RELEVANT_LEADS"


def _error_kind(codes: list[str], status: str, results: int) -> str:
    """Nature lisible : authentification, réseau, quota, aucun résultat, etc."""
    if "auth" in codes:
        return "authentification"
    if "quota" in codes:
        return "quota_depasse"
    if any(c in ("network", "timeout") for c in codes):
        return "reseau"
    if codes:
        return "erreur_source"
    if status == "SUCCESS_NO_RESULTS":
        return "aucun_resultat"
    return "aucune"


def _run_status(report: Report) -> str:
    statuses = [s["status"] for s in report.sources.values()]
    if report.notif["generated"] and report.notif["accepted"] < report.notif["generated"]:
        return "EMAIL_FAILED"
    ran = [s for s in statuses if s not in ("SOURCE_NOT_RUN", "SOURCE_NOT_CONFIGURED")]
    if not ran:
        return "SOURCE_NOT_RUN"
    if "SUCCESS_WITH_LEADS" in ran:
        return "SUCCESS_WITH_LEADS"
    if all(s == "SEARCH_FAILED" for s in ran):
        return "SEARCH_FAILED"
    if any(s in ("SEARCH_FAILED", "PARTIAL_SUCCESS") for s in ran):
        return "PARTIAL_SUCCESS"
    if "SUCCESS_NO_RELEVANT_LEADS" in ran:
        return "SUCCESS_NO_RELEVANT_LEADS"
    return "SUCCESS_NO_RESULTS"


def _minutes_since(published: datetime | None, now: datetime) -> float | None:
    if not published:
        return None
    return max(0.0, (now - published).total_seconds() / 60)


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
    daily.setdefault("run_times", []).append(now.isoformat(timespec="seconds"))
    report = Report(mode=mode, started_at=now.isoformat(timespec="seconds"), local_start=local_now.isoformat(timespec="seconds"))
    engine_mode = "assiste" if mode in ("assiste", "test") else "surveillance"

    def empty_entry(status: str, reason: str | None = None) -> dict:
        e = {"status": status, "planned": 0, "sent": 0, "succeeded": 0, "failed": 0, "error_codes": [], "results": 0,
             "duplicates": 0, "relevant": 0, "eliminated": {}, "alerts": 0, "cost_usd": 0.0, "queries": [], "lieux_couverts": 0,
             "delai_publication_detection_min": None}
        if reason:
            e["reason"] = reason
        return e

    # 1. Collecte
    results: dict[str, SourceResult] = {}
    if collected is not None:
        results = collected
    elif not _in_hours(cfg, local_now):
        report.outside_hours = True
        for sid in cfg.get("sources", {}):
            report.sources[sid] = empty_entry("SOURCE_NOT_RUN", "hors des heures de surveillance")
    else:
        for sid, scfg in cfg.get("sources", {}).items():
            if not scfg.get("enabled"):
                report.sources[sid] = empty_entry("SOURCE_NOT_RUN", "source désactivée dans la configuration")
                continue
            if not _interval_ok(state, sid, now, int(scfg.get("min_interval_minutes", 30))):
                report.sources[sid] = empty_entry("SOURCE_NOT_RUN", "intervalle minimal non écoulé")
                continue
            try:
                t0 = _clock()
                results[sid] = collect(sid, scfg, cfg, state, env, now, http_kwargs)
                results[sid].duration_ms = int((_clock() - t0) * 1000)
            except SourceNotConfigured as exc:
                report.sources[sid] = empty_entry("SOURCE_NOT_CONFIGURED", str(exc))
            except SourceDisabled as exc:
                report.sources[sid] = empty_entry("SOURCE_NOT_RUN", str(exc))

    # 2. Qualification + déduplication
    to_notify: list[tuple[dict, RawItem, str, float | None]] = []
    for sid, res in results.items():
        cost = res.paid_requests * float(cfg.get("sources", {}).get(sid, {}).get("cost_per_query_usd", 0))
        entry = empty_entry("SOURCE_NOT_RUN")
        entry.update(
            planned=res.planned if res.planned is not None else len(res.queries),
            sent=len(res.queries),
            failed=len(res.errors),
            succeeded=max(0, len(res.queries) - len(res.errors)),
            error_codes=res.errors,
            results=len(res.items),
            cost_usd=round(cost, 4),
            queries=res.queries,
            lieux_couverts=len(set(res.lieux)),
            duration_ms=getattr(res, "duration_ms", None),
        )
        if res.skipped_reason:
            entry["reason"] = res.skipped_reason
        report.sources[sid] = entry
        daily["queries"] += len(res.queries)
        if res.queries:
            daily["sources"] += 1
        if res.errors:
            daily["errors"] += len(res.errors)
            state.record_error(sid, now, res.errors[-1])
        elif res.queries:
            state.record_success(sid, now)

        unique: dict[str, RawItem] = {}
        for it in res.items:
            unique.setdefault(it.external_id or it.url or f"{it.title}{it.content}", it)
        items = list(unique.values())
        entry["duplicates"] += len(res.items) - len(items)
        report.duplicates += len(res.items) - len(items)
        if items:
            try:
                qualified = qualify_fn(items, source_id=sid, mode=engine_mode, now_iso=now.isoformat())
            except QualifyError as exc:
                entry["error_codes"] = [*entry["error_codes"], "qualification"]
                entry["failed"] = entry["sent"]  # rien n'a pu être analysé
                report.notification_errors.append(str(exc)[:200])
                qualified = []
                items = []

            # Sources dont les conditions interdisent la conservation (Brave) :
            # déduplication limitée au passage, rien n'est mémorisé.
            persist = cfg.get("sources", {}).get(sid, {}).get("persist_results", True)
            seen_now: set[str] = set()
            delays: list[float] = []
            for item, r in zip(items, qualified):
                report.analysed += 1
                daily["items"] += 1
                if (persist and state.find_seen(r["dedupeKeys"])) or seen_now.intersection(r["dedupeKeys"]):
                    report.duplicates += 1
                    entry["duplicates"] += 1
                    continue
                seen_now.update(r["dedupeKeys"])
                if persist:
                    state.remember(r["dedupeKeys"], now)
                report.by_class[r["classe"]] = report.by_class.get(r["classe"], 0) + 1
                metier = r.get("metier") or "aucun"
                m = report.by_metier.setdefault(metier, {"analyses": 0, "demandes": 0, "urgentes": 0, "hors_prestation": 0, "a_confirmer": 0})
                m["analyses"] += 1
                brute = r.get("classeBrute", r["classe"])
                if brute in LEAD_CLASSES_DEFAULT:
                    m["demandes"] += 1
                    if r.get("niveauUrgence") == "ELEVEE" or (r.get("niveauUrgence") is None and r.get("urgente")):
                        m["urgentes"] += 1
                    daily[f"demandes_{metier}"] = daily.get(f"demandes_{metier}", 0) + 1
                if r["classe"] == "HORS_PRESTATION":
                    m["hors_prestation"] += 1
                if r["classe"] == "PRESTATION_A_CONFIRMER":
                    m["a_confirmer"] += 1
                if r["classe"] in LEAD_CLASSES_DEFAULT:
                    entry["relevant"] += 1
                    if persist:
                        loc = r.get("localisation") or {}
                        report.opportunities.append({
                            "source_id": sid,
                            "key": r["dedupeKeys"][0],
                            "detected_at": now.isoformat(),
                            "published_at": item.published_at.isoformat() if item.published_at else None,
                            "classe": r["classe"],
                            "niveau_urgence": r.get("niveauUrgence"),
                            "confiance": r.get("confiance"),
                            "score": r.get("score"),
                            "service": (r.get("services") or [None])[0],
                            "commune": loc.get("nom"),
                            "departement": loc.get("departement"),
                            "url": item.url if (item.url or "").startswith("https://") else None,
                        })
                    daily["demandes"] += 1
                    delay = _minutes_since(item.published_at, now)
                    if delay is not None:
                        delays.append(delay)
                    if r["classe"] in cfg.get("notify_classes", LEAD_CLASSES_DEFAULT) and r["score"] >= int(cfg.get("notify_min_score", 0)):
                        to_notify.append((r, item, sid, delay))
                else:
                    entry["eliminated"][r["classe"]] = entry["eliminated"].get(r["classe"], 0) + 1
            if delays:
                entry["delai_publication_detection_min"] = {"median": round(statistics.median(delays)), "max": round(max(delays))}
        entry["status"] = _source_status(entry)
        entry["error_kind"] = _error_kind(entry["error_codes"], entry["status"], entry["results"])

    # 3. Alertes : un e-mail par nouvelle demande pertinente, dès la qualification.
    persist_of = {sid: cfg.get("sources", {}).get(sid, {}).get("persist_results", True) for sid in results}
    detected_at = local_now.strftime("%Y-%m-%d %H:%M (%Z)")
    pending = [p for p in to_notify if not (persist_of.get(p[2], True) and state.was_notified(p[0]["dedupeKeys"][0]))]

    if pending and mailer is None and mode != "test":
        report.notification_errors.append("notifications non configurées (RESEND_API_KEY / LEAD_RADAR_*)")
        report.notification_impossible = True
        report.notif["generated"] += len(pending)
    if mailer is not None and cfg.get("alerts_enabled") is False:
        report.notification_errors.append("alertes désactivées par l'administrateur")
        pending = []
    if mailer is not None:
        # Les plus urgents d'abord.
        order = {"ELEVEE": 0, "RAPIDE": 1, "DEVIS": 2, "NON_URGENTE": 3}
        pending.sort(key=lambda p: (order.get(p[0].get("niveauUrgence", "NON_URGENTE"), 3), -p[0]["score"]))
        for r, it, sid, delay in pending:
            report.notif["generated"] += 1
            report.sources[sid]["alerts"] += 1
            try:
                mailer.send(
                    lead_subject(r),
                    lead_body(r, it, source_nom=SOURCE_NAMES.get(sid, sid), detected_at=detected_at, with_response=mode != "surveillance", delay_min=delay),
                    f"lead-{r['dedupeKeys'][0]}",
                )
                if persist_of.get(sid, True):
                    state.mark_notified(r["dedupeKeys"][0], now)
                report.notifications_sent += 1
                report.notif["accepted"] += 1
            except NotifyError as exc:
                report.notification_errors.append(str(exc))
                report.notif[exc.kind] = report.notif.get(exc.kind, 0) + 1
        if pending and report.notif["accepted"] == 0:
            report.notification_impossible = True
    daily["notifications"] += report.notifications_sent
    daily["notif_accepted"] = daily.get("notif_accepted", 0) + report.notif["accepted"]
    daily["notif_failed"] = daily.get("notif_failed", 0) + (report.notif["generated"] - report.notif["accepted"])

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

    # 5. Statut du passage
    report.status = _run_status(report)
    st = daily.setdefault("status", {})
    st[report.status] = st.get(report.status, 0) + 1
    if report.notification_impossible:
        daily["notification_impossible"] = daily.get("notification_impossible", 0) + 1
    state.data["last_run"] = {"at": now.isoformat(timespec="seconds"), "status": report.status, "run_id": report.run_id}
    if report.status in ("SUCCESS_WITH_LEADS", "SUCCESS_NO_RELEVANT_LEADS", "SUCCESS_NO_RESULTS"):
        state.data["last_success_at"] = now.isoformat(timespec="seconds")

    # 6. Synthèse quotidienne (rapport de santé)
    if mailer is not None and local_now.hour >= int(cfg.get("daily_summary_hour", 20)) and state.data["last_summary_date"] != today:
        try:
            mailer.send(f"[LEAD RADAR] Synthèse du {today}", daily_summary(state, cfg, today, now, tz), f"summary-{today}")
            state.data["last_summary_date"] = today
            report.summary_sent = True
        except NotifyError as exc:
            report.notification_errors.append(str(exc))

    # 7. Livraison réelle (accepté ≠ remis)
    check = getattr(mailer, "check_deliveries", None)
    if check and getattr(mailer, "sent_ids", None):
        report.delivery = check(wait_seconds=float(cfg.get("delivery_check_seconds", 8)))

    state.purge(now, int(cfg.get("retention_days", 60)))
    report.finished_at = datetime.now(now.tzinfo).isoformat(timespec="seconds")
    state.add_run(report.record())
    return report


def daily_summary(state: State, cfg: dict, today: str, now: datetime, tz: ZoneInfo) -> str:
    d = state.daily(today)
    times = sorted(datetime.fromisoformat(t) for t in d.get("run_times", []))
    gaps = [(b - a).total_seconds() / 60 for a, b in zip(times, times[1:])]
    cadence = (
        f"Premier passage : {times[0].astimezone(tz):%H:%M}, dernier : {times[-1].astimezone(tz):%H:%M}, "
        f"écart moyen {sum(gaps) / len(gaps):.0f} min, écart maximal {max(gaps):.0f} min"
        if gaps
        else "Un seul passage aujourd'hui : écart non mesurable"
    )
    month = now.astimezone(tz).strftime("%Y-%m")
    status_txt = "\n".join(f"  - {STATUS_LABELS.get(k, k)} ({k}) : {v}" for k, v in sorted(d.get("status", {}).items())) or "  - aucun"
    sources_txt = "\n".join(
        f"  - {SOURCE_NAMES.get(sid, sid)} : dernier succès {s.get('last_success') or 'jamais'}, erreurs consécutives {s.get('consecutive_errors', 0)}"
        for sid, s in state.data["sources"].items()
    )
    brave_cfg = cfg.get("sources", {}).get("brave_search", {})
    return (
        f"Passages : {d['runs']}\nRecherches envoyées : {d['queries']}\nConsultations de sources : {d['sources']}\n"
        f"Éléments analysés : {d['items']}\nDemandes pertinentes : {d['demandes']}\n"
        f"  dont serrurerie : {d.get('demandes_serrurerie', 0)} — dont plomberie (non proposée, non notifiée) : {d.get('demandes_plomberie', 0)}\n"
        f"Cadence : {cadence}\n"
        f"Dernier passage réussi : {state.data.get('last_success_at') or 'aucun'}\n\n"
        f"Statuts des passages du jour :\n{status_txt}\n\n"
        f"Alertes : {d.get('notif_accepted', 0)} acceptée(s) par Resend, {d.get('notif_failed', 0)} en échec\n"
        f"Couverture Brave depuis le début : {state.coverage_count('brave_search')} lieu(x) distinct(s) recherché(s)\n"
        f"Brave, mois en cours (estimation) : {state.spend(month):.3f} $ sur un plafond de {brave_cfg.get('monthly_budget_usd', 0)} $\n\n"
        f"État des sources :\n{sources_txt}\n\n"
        "Une erreur de recherche n'est jamais comptée comme une recherche sans résultat. "
        "« Accepté par Resend » ne garantit pas la réception : l'état de livraison est vérifié séparément."
    )


def load_config(path: Path) -> dict:
    return json.loads(path.read_text("utf-8"))
