"""Notifications e-mail via Resend (déjà utilisé par le site).

- Un prospect n'est notifié qu'une fois (empreinte dans l'état pour les sources
  qui l'autorisent + clé d'idempotence Resend).
- Le numéro proposé est vérifié avant tout envoi : jamais l'ancien numéro.
- Les échecs sont typés (refus, erreur temporaire, erreur permanente) et le
  prospect n'est PAS marqué notifié en cas d'échec.
- « Accepté par Resend » ne veut pas dire « reçu » : l'état de livraison est
  vérifié ensuite via l'API Resend quand c'est possible.
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass

from .http import HttpError, request, request_with_retry

RESEND_ENDPOINT = "https://api.resend.com/emails"
FORBIDDEN_PHONE = re.compile(r"0?7[\s.]?54[\s.]?47[\s.]?12[\s.]?50")

# Événements Resend (last_event) → état lisible.
DELIVERY_STATES = {
    "delivered": "remis",
    "sent": "envoyé (remise non confirmée)",
    "queued": "en file d'attente",
    "scheduled": "programmé",
    "delivery_delayed": "remise retardée",
    "bounced": "rejeté par le destinataire",
    "complained": "signalé comme spam",
    "failed": "échec",
}


class NotifyError(Exception):
    """kind : refused | permanent | temporary | blocked."""

    def __init__(self, message: str, kind: str = "permanent", code: str | None = None):
        super().__init__(message)
        self.kind = kind
        self.code = code


def _diagnose(exc: HttpError) -> NotifyError:
    status = exc.status
    if status in (401, 403):
        return NotifyError("Resend : clé API refusée ou sans droit d'envoi (configuration)", "permanent", "auth")
    if status == 422:
        return NotifyError("Resend : requête refusée (adresse destinataire ou expéditeur/domaine invalide)", "refused", "invalid")
    if status == 429 or exc.code == "quota":
        return NotifyError("Resend : quota ou limite de débit atteint", "temporary", "quota")
    if exc.retryable:
        return NotifyError(f"Resend : erreur temporaire ({exc.code} {status or ''})".strip(), "temporary", exc.code)
    return NotifyError(f"Resend : erreur {exc.code} {status or ''}".strip(), "permanent", exc.code)


@dataclass
class Mailer:
    api_key: str
    sender: str
    recipients: list[str]
    http_kwargs: dict | None = None
    sent_ids: list[str] | None = None

    @classmethod
    def from_env(cls, env: dict) -> "Mailer | None":
        key = env.get("RESEND_API_KEY")
        sender = env.get("LEAD_RADAR_SENDER_EMAIL")
        to = [e.strip() for e in (env.get("LEAD_RADAR_NOTIFICATION_EMAIL") or "").split(",") if e.strip()]
        if not (key and sender and to):
            return None
        return cls(key, sender, to)

    def send(self, subject: str, text: str, idempotency_key: str) -> str:
        """Renvoie l'identifiant Resend si la requête est ACCEPTÉE. Lève NotifyError sinon."""
        if FORBIDDEN_PHONE.search(text) or FORBIDDEN_PHONE.search(subject):
            raise NotifyError("ancien numéro détecté dans la notification : envoi bloqué", "blocked", "old_phone")
        body = json.dumps({"from": self.sender, "to": self.recipients, "subject": subject, "text": text}).encode()
        try:
            # 3 tentatives maximum, uniquement sur erreurs temporaires (réseau, 429, 5xx).
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
            raise _diagnose(exc) from exc
        message_id = str(res.json().get("id", ""))
        if not message_id:
            raise NotifyError("Resend : réponse sans identifiant de message", "permanent", "no_id")
        if self.sent_ids is None:
            self.sent_ids = []
        self.sent_ids.append(message_id)
        return message_id

    def delivery_state(self, message_id: str) -> str:
        """Dernier événement connu chez Resend (delivered, bounced…) ou 'unknown'."""
        try:
            res = request(
                f"{RESEND_ENDPOINT}/{message_id}",
                headers={"Authorization": f"Bearer {self.api_key}"},
                **{k: v for k, v in (self.http_kwargs or {}).items() if k == "opener"},
            )
            return str(res.json().get("last_event") or "unknown")
        except HttpError:
            return "unknown"

    def check_deliveries(self, wait_seconds: float = 8.0, sleep=time.sleep) -> dict[str, int]:
        """Compte les états de livraison des messages envoyés pendant ce passage."""
        ids = self.sent_ids or []
        if not ids:
            return {}
        sleep(wait_seconds)
        counts: dict[str, int] = {}
        for mid in ids:
            state = self.delivery_state(mid)
            counts[state] = counts.get(state, 0) + 1
        return counts


def _loc(r: dict) -> tuple[str, str]:
    loc = r.get("localisation")
    if not loc:
        return "Localisation inconnue", ""
    if loc.get("nom"):
        return f"{loc['nom']} ({loc['departement']})", f"{loc['nom']} ({loc['departement']})"
    return f"Département {loc['departement']}", f"({loc['departement']})"


NIVEAUX = {
    "ELEVEE": "URGENCE ÉLEVÉE",
    "RAPIDE": "INTERVENTION RAPIDE SOUHAITÉE",
    "NON_URGENTE": "NON URGENTE",
    "DEVIS": "DEMANDE DE DEVIS",
}


def lead_subject(r: dict) -> str:
    """[NOUVELLE DEMANDE SERRURERIE] — [ZONE] — [URGENCE]"""
    _, short = _loc(r)
    zone = short or "Zone inconnue"
    niveau = r.get("niveauUrgence") or ("ELEVEE" if r.get("urgente") else "NON_URGENTE")
    return f"[NOUVELLE DEMANDE SERRURERIE] — {zone} — {NIVEAUX.get(niveau, niveau)}"


def lead_body(r: dict, item, *, source_nom: str, detected_at: str, with_response: bool, delay_min: float | None = None) -> str:
    loc, _ = _loc(r)
    lignes = "\n".join(f"  - {l['critere']} : {l['points']}/{l['max']} — {l['raison']}" for l in r.get("lignes", []))
    excerpt = (f"{item.title} — {item.content}" if item.title else item.content).strip()
    excerpt = excerpt[:400] + ("…" if len(excerpt) > 400 else "")
    niveau = r.get("niveauUrgence")
    delai = f"{delay_min / 60:.1f} h" if delay_min is not None and delay_min >= 90 else (f"{delay_min:.0f} min" if delay_min is not None else "inconnu (date de publication absente)")
    parts = [
        f"Prestation : {', '.join(r.get('services') or ['non précisée'])}",
        f"Zone : {loc}",
        f"Urgence : {NIVEAUX.get(niveau, 'non évaluée')}" + (f" — {r['niveauUrgenceRaison']}" if r.get("niveauUrgenceRaison") else ""),
        f"Confiance : {r.get('confiance', 'non évaluée')}" + (f" — {r['confianceRaison']}" if r.get("confianceRaison") else ""),
        f"Type : {r['classe']} ({r['categorieRaison']})",
        f"Score de pertinence : {r['score']}/100 (classement interne, pas une probabilité de conversion)",
        lignes,
        "",
        f"Publiée le : {item.published_at.isoformat() if item.published_at else 'date inconnue'}",
        f"Détectée le : {detected_at} (délai publication → détection : {delai})",
        f"Source : {source_nom}",
        f"Lien direct : {item.url or 'non disponible'}",
        "",
        "Extrait (strictement nécessaire) :",
        f"« {excerpt} »",
        "",
        f"Prochaine action recommandée : {r.get('actionRecommandee') or 'vérifier la publication avant toute réponse.'}",
        "Statut : demande DÉTECTÉE automatiquement, non vérifiée par un humain. Rien n'a été publié ni envoyé à cette personne.",
    ]
    if with_response and r.get("reponseProposee"):
        parts += ["", "Réponse proposée (à publier vous-même si la plateforme l'autorise) :", r["reponseProposee"]]
    parts += ["", "— Lead Radar, Serrurerie Louis & Fils"]
    return "\n".join(parts)
