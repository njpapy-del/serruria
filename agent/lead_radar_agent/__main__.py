"""Point d'entrée : python -m lead_radar_agent --mode assiste

Modes :
  test         : données fictives (agent/tests/fixtures), aucun appel aux sources ;
                 aucun e-mail sauf avec --send-email.
  surveillance : sources réelles, alertes sans réponse proposée.
  assiste      : sources réelles, alertes avec réponse proposée à valider.
La publication automatique n'existe pas dans l'agent.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from .http import HttpError, request
from .notify import Mailer, NotifyError
from .run import load_config, run_once
from .sources.base import RawItem, SourceResult
from .state import State

AGENT_DIR = Path(__file__).resolve().parents[1]


def _fixture_results() -> dict[str, SourceResult]:
    data = json.loads((AGENT_DIR / "tests" / "fixtures" / "demandes_fictives.json").read_text("utf-8"))
    items = [
        RawItem("bluesky", d["id"], d["url"], "", d["text"], datetime.fromisoformat(d["published_at"]))
        for d in data
    ]
    return {"bluesky": SourceResult("bluesky", queries=["(test)"], items=items)}


def resend_check(mailer: Mailer | None, now: datetime) -> int:
    """Test d'intégration Resend : un e-mail de contrôle au destinataire configuré.
    Rapporte acceptation, identifiant et état de livraison réel."""
    if mailer is None:
        print(json.dumps({"resend_check": "configuration incomplète (RESEND_API_KEY, LEAD_RADAR_SENDER_EMAIL, LEAD_RADAR_NOTIFICATION_EMAIL)"}, ensure_ascii=False))
        return 2
    out: dict = {"started_at": now.isoformat(timespec="seconds")}
    try:
        out["message_id"] = mailer.send(
            "[LEAD RADAR] [TEST INTÉGRATION] Vérification de la configuration Resend",
            "Ceci est un e-mail de contrôle technique du Lead Radar (aucun prospect).\n"
            f"Envoyé le {now.isoformat(timespec='seconds')}.\n"
            "S'il arrive dans votre boîte, la chaîne d'alerte fonctionne jusqu'à vous.",
            f"resend-check-{now.isoformat(timespec='minutes')}",
        )
        out["accepted"] = True
        out["delivery"] = mailer.check_deliveries(wait_seconds=10)
    except NotifyError as exc:
        out.update(accepted=False, error_kind=exc.kind, error_code=exc.code, error=str(exc))
    print(json.dumps(out, ensure_ascii=False))
    return 0 if out.get("accepted") and "delivered" in out.get("delivery", {}) else 1


def heartbeat(env: dict, status: str | None, http_kwargs: dict | None = None) -> None:
    """Signal de vie (Healthchecks.io ou compatible) : succès, ou /fail si la recherche
    ou l'envoi a échoué, ou si aucune recherche n'a été faite. Sans URL : rien."""
    url = env.get("HEALTHCHECK_PING_URL")
    if not url:
        return
    ok = status in ("SUCCESS_WITH_LEADS", "SUCCESS_NO_RELEVANT_LEADS", "SUCCESS_NO_RESULTS")
    try:
        request(url.rstrip("/") + ("" if ok else "/fail"), method="POST", data=(status or "").encode(), timeout=10, **(http_kwargs or {}))
    except HttpError:
        pass  # le service de surveillance détectera l'absence de signal


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="lead_radar_agent")
    p.add_argument("--mode", choices=["test", "surveillance", "assiste", "resend-check", "gsc-report"], default="assiste")
    p.add_argument("--config", type=Path, default=AGENT_DIR / "config.json")
    p.add_argument("--state", type=Path, default=AGENT_DIR / ".state" / "state.json")
    p.add_argument("--no-email", action="store_true", help="n'envoie aucun e-mail")
    p.add_argument("--send-email", action="store_true", help="mode test : envoie réellement les e-mails (objet préfixé [TEST])")
    args = p.parse_args(argv)

    cfg = load_config(args.config)
    env = dict(os.environ)
    now = datetime.now(timezone.utc)
    mailer = None if args.no_email else Mailer.from_env(env)

    if args.mode == "resend-check":
        return resend_check(mailer, now)

    if args.mode == "gsc-report":
        from .gsc import GscError, GscNotConfigured, fetch_report, report_email

        try:
            report = fetch_report(env)
        except GscNotConfigured as exc:
            print(json.dumps({"gsc_report": "SOURCE_NOT_CONFIGURED", "detail": str(exc)}, ensure_ascii=False))
            return 2
        except GscError as exc:
            print(json.dumps({"gsc_report": "SEARCH_FAILED", "detail": str(exc)}, ensure_ascii=False))
            return 1
        subject, body = report_email(report)
        sent = None
        if mailer:
            sent = mailer.send(subject, body, f"gsc-{report['periode']['fin']}")
        print(json.dumps({"gsc_report": "SUCCESS", "periode": report["periode"], "totaux": report["totaux"], "requetes": len(report["requetes"]), "email_id": sent}, ensure_ascii=False))
        return 0

    if args.mode == "test":
        state = State(AGENT_DIR / ".state" / "test-state.json")  # état jetable
        if mailer and args.send_email:
            real_send = mailer.send
            mailer.send = lambda s, t, k: real_send(f"[TEST — données fictives] {s}", "CECI EST UN TEST SUR DES DONNÉES FICTIVES.\n\n" + t, f"test-{now.isoformat()}-{k}")
        else:
            mailer = None
        report = run_once(mode="test", cfg=cfg, state=state, env=env, now=now, mailer=mailer, collected=_fixture_results())
    else:
        state = State.load(args.state)
        from .settings import load_remote

        cfg, config_source = load_remote(cfg, env)
        report = run_once(mode=args.mode, cfg=cfg, state=state, env=env, now=now, mailer=mailer)
        report.config_source = config_source
        state.save()
        from .ingest import push

        ingest_status = push(env, report, state)
        state.save()
        if ingest_status.startswith("error"):
            print(f"Tableau de bord : envoi impossible ({ingest_status})", file=sys.stderr)
        heartbeat(env, report.status)

    print(report.public_log())
    if report.search_failed or report.notification_errors:
        print("ERREUR : au moins une recherche ou une notification a échoué (voir codes ci-dessus).", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except NotifyError as exc:  # pragma: no cover
        print(f"ERREUR notification : {exc}", file=sys.stderr)
        sys.exit(1)
