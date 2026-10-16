"""Notifications e-mail via Resend (déjà utilisé par le site).

- Un prospect n'est notifié qu'une fois (empreinte dans l'état + clé
  d'idempotence Resend).
- Le numéro proposé est vérifié avant tout envoi : jamais l'ancien numéro.
- Une erreur d'envoi est remontée, et le prospect n'est PAS marqué notifié
  (il sera retenté au passage suivant).
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

from .http import HttpError, request_with_retry

RESEND_ENDPOINT = "https://api.resend.com/emails"
FORBIDDEN_PHONE = re.compile(r"0?7[\s.]?54[\s.]?47[\s.]?12[\s.]?50")
EXPECTED_PHONE = "01 85 50 02 70"


class NotifyError(Exception):
    pass


@dataclass
class Mailer:
    api_key: str
    sender: str
    recipients: list[str]
    http_kwargs: dict | None = None

    @classmethod
    def from_env(cls, env: dict) -> "Mailer | None":
        key = env.get("RESEND_API_KEY")
        sender = env.get("LEAD_RADAR_SENDER_EMAIL")
        to = [e.strip() for e in (env.get("LEAD_RADAR_NOTIFICATION_EMAIL") or "").split(",") if e.strip()]
        if not (key and sender and to):
            return None
        return cls(key, sender, to)

    def send(self, subject: str, text: str, idempotency_key: str) -> str:
        if FORBIDDEN_PHONE.search(text) or FORBIDDEN_PHONE.search(subject):
            raise NotifyError("ancien numéro détecté dans la notification : envoi bloqué")
        body = json.dumps({"from": self.sender, "to": self.recipients, "subject": subject, "text": text}).encode()
        try:
            res = request_with_retry(
                RESEND_ENDPOINT,
                method="POST",
                data=body,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "Idempotency-Key": idempotency_key[:256],
                },
                **(self.http_kwargs or {}),
            )
        except HttpError as exc:
            raise NotifyError(f"Resend : {exc.code} {exc.status or ''}".strip()) from exc
        return str(res.json().get("id", ""))


def _loc(r: dict) -> tuple[str, str]:
    loc = r.get("localisation")
    if not loc:
        return "Localisation inconnue", ""
    if loc.get("nom"):
        return f"{loc['nom']} ({loc['departement']})", f"{loc['nom']} ({loc['departement']})"
    return f"Département {loc['departement']}", f"({loc['departement']})"


def lead_subject(r: dict) -> str:
    besoin = (r.get("services") or ["Serrurerie"])[0]
    besoin = "Besoin de serrurier" if besoin.startswith("Besoin de serrurier") else besoin
    _, short = _loc(r)
    urgent = " [URGENT]" if r.get("urgente") else ""
    lieu = f" — {short}" if short else ""
    return f"[LEAD RADAR]{urgent} {besoin}{lieu}"


def lead_body(r: dict, item, *, source_nom: str, detected_at: str, with_response: bool) -> str:
    loc, _ = _loc(r)
    lignes = "\n".join(f"  - {l['critere']} : {l['points']}/{l['max']} — {l['raison']}" for l in r.get("lignes", []))
    excerpt = (f"{item.title} — {item.content}" if item.title else item.content).strip()
    excerpt = excerpt[:600] + ("…" if len(excerpt) > 600 else "")
    parts = [
        f"Type de demande : {', '.join(r.get('services') or ['non précisé'])}",
        f"Classe : {r['classe']} — {r['categorie']} ({r['categorieRaison']})",
        f"Urgence : {'OUI' if r.get('urgente') else 'non exprimée'}",
        f"Score de pertinence : {r['score']}/100 (classement interne, pas une probabilité de conversion)",
        lignes,
        "",
        f"Localisation : {loc}",
        f"Publiée le : {item.published_at.isoformat() if item.published_at else 'date inconnue'}",
        f"Détectée le : {detected_at}",
        f"Source : {source_nom}",
        f"Lien direct : {item.url or 'non disponible'}",
        "",
        "Extrait fidèle de la publication :",
        f"« {excerpt} »",
        "",
        "Vérification humaine nécessaire : OUI — rien n'a été publié ni envoyé à cette personne.",
    ]
    if with_response and r.get("reponseProposee"):
        parts += ["", "Réponse proposée (à publier vous-même si la plateforme l'autorise) :", r["reponseProposee"]]
    parts += ["", "— Lead Radar, Serrurerie Louis & Fils"]
    return "\n".join(parts)
