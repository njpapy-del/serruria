"""Requêtes HTTP (bibliothèque standard) avec erreurs typées et nouvelles tentatives.

Une erreur de recherche est toujours remontée comme erreur : elle n'est jamais
transformée en « recherche réussie sans résultat ».
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Callable

USER_AGENT = "SerrurerieLouisFils-LeadRadar/1.0 (+https://serrurerielouisfils.com)"
MAX_BYTES = 2_000_000


class HttpError(Exception):
    """code : auth | network | timeout | http | quota | parse | too_large."""

    def __init__(self, message: str, code: str, status: int | None = None, retryable: bool = False):
        super().__init__(message)
        self.code = code
        self.status = status
        self.retryable = retryable


@dataclass
class Response:
    status: int
    headers: dict[str, str]
    body: bytes

    def text(self) -> str:
        charset = "utf-8"
        ctype = self.headers.get("content-type", "")
        if "charset=" in ctype:
            charset = ctype.split("charset=")[-1].split(";")[0].strip() or "utf-8"
        return self.body.decode(charset, errors="replace")

    def json(self) -> Any:
        try:
            return json.loads(self.body)
        except ValueError as exc:
            raise HttpError("Réponse JSON invalide.", "parse") from exc


Opener = Callable[[urllib.request.Request, float], Any]


def _default_opener(req: urllib.request.Request, timeout: float):
    return urllib.request.urlopen(req, timeout=timeout)  # noqa: S310 (URL contrôlée par l'appelant)


def request(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    data: bytes | None = None,
    timeout: float = 15.0,
    opener: Opener = _default_opener,
) -> Response:
    if not url.startswith(("https://", "http://")):
        raise HttpError("Schéma d'URL non autorisé.", "http")
    req = urllib.request.Request(url, data=data, method=method, headers={"User-Agent": USER_AGENT, **(headers or {})})
    try:
        with opener(req, timeout) as res:
            body = res.read(MAX_BYTES + 1)
            if len(body) > MAX_BYTES:
                raise HttpError("Réponse trop volumineuse.", "too_large")
            return Response(res.status, {k.lower(): v for k, v in res.headers.items()}, body)
    except urllib.error.HTTPError as exc:
        status = exc.code
        if status == 429:
            raise HttpError("Quota atteint (HTTP 429).", "quota", status, retryable=True) from exc
        if status in (401, 403):
            raise HttpError(f"Authentification ou accès refusé (HTTP {status}).", "auth", status) from exc
        raise HttpError(f"Réponse HTTP {status}.", "http", status, retryable=status >= 500) from exc
    except TimeoutError as exc:
        raise HttpError("Délai dépassé.", "timeout", retryable=True) from exc
    except urllib.error.URLError as exc:
        if isinstance(exc.reason, TimeoutError):
            raise HttpError("Délai dépassé.", "timeout", retryable=True) from exc
        raise HttpError("Erreur réseau.", "network", retryable=True) from exc


def request_with_retry(url: str, *, attempts: int = 3, backoff: float = 2.0, sleep=time.sleep, **kwargs) -> Response:
    """Réessaie uniquement les erreurs temporaires (réseau, délai, 429, 5xx)."""
    last: HttpError | None = None
    for attempt in range(attempts):
        try:
            return request(url, **kwargs)
        except HttpError as exc:
            last = exc
            if not exc.retryable or attempt == attempts - 1:
                raise
            sleep(backoff * (2**attempt))
    raise last  # pragma: no cover
