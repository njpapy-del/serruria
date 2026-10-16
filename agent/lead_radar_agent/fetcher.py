"""Récupération respectueuse de pages publiques.

- Respect de robots.txt (refus si robots.txt interdit ou illisible pour cause d'erreur 401/403).
- Une requête à la fois, délai minimal par site.
- Aucune connexion à un compte, aucun contournement de CAPTCHA : une page
  protégée est classée « inaccessible ».
- Seul le texte utile est extrait, en mémoire ; rien n'est écrit sur disque.
"""

from __future__ import annotations

import time
import urllib.robotparser
from html.parser import HTMLParser
from urllib.parse import urlsplit

from .http import USER_AGENT, HttpError, Opener, request

CAPTCHA_MARKERS = ("captcha", "cf-challenge", "verify you are human", "vérifiez que vous êtes humain", "datadome")


class Inaccessible(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


class _TextExtractor(HTMLParser):
    SKIP = {"script", "style", "noscript", "svg", "nav", "footer", "header", "form"}

    def __init__(self):
        super().__init__()
        self.parts: list[str] = []
        self.title = ""
        self._skip = 0
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self._skip += 1
        if tag == "title":
            self._in_title = True

    def handle_endtag(self, tag):
        if tag in self.SKIP and self._skip:
            self._skip -= 1
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        elif not self._skip and data.strip():
            self.parts.append(data.strip())


def extract_text(html: str, max_chars: int = 4000) -> tuple[str, str]:
    parser = _TextExtractor()
    parser.feed(html)
    return parser.title.strip(), " ".join(parser.parts)[:max_chars]


class PoliteFetcher:
    def __init__(self, *, min_delay: float = 5.0, opener: Opener | None = None, sleep=time.sleep, clock=time.monotonic):
        self.min_delay = min_delay
        self.opener = opener
        self.sleep = sleep
        self.clock = clock
        self._robots: dict[str, urllib.robotparser.RobotFileParser | None] = {}
        self._last_hit: dict[str, float] = {}

    def _kwargs(self):
        return {"opener": self.opener} if self.opener else {}

    def _wait(self, host: str) -> None:
        last = self._last_hit.get(host)
        if last is not None:
            delta = self.clock() - last
            if delta < self.min_delay:
                self.sleep(self.min_delay - delta)
        self._last_hit[host] = self.clock()

    def allowed(self, url: str) -> bool:
        parts = urlsplit(url)
        origin = f"{parts.scheme}://{parts.netloc}"
        if origin not in self._robots:
            rp = urllib.robotparser.RobotFileParser()
            try:
                self._wait(parts.netloc)
                res = request(f"{origin}/robots.txt", timeout=10, **self._kwargs())
                rp.parse(res.text().splitlines())
                self._robots[origin] = rp
            except HttpError as exc:
                if exc.status in (401, 403):
                    self._robots[origin] = None  # accès refusé : on s'abstient
                elif exc.status and 400 <= exc.status < 500:
                    rp.parse([])  # pas de robots.txt : tout est permis
                    self._robots[origin] = rp
                else:
                    raise
        rp = self._robots[origin]
        return bool(rp and rp.can_fetch(USER_AGENT, url))

    def fetch(self, url: str) -> tuple[str, str]:
        """Renvoie (titre, texte). Lève Inaccessible ou HttpError."""
        if not self.allowed(url):
            raise Inaccessible("robots.txt n'autorise pas la consultation automatisée")
        host = urlsplit(url).netloc
        self._wait(host)
        try:
            res = request(url, timeout=15, headers={"Accept": "text/html"}, **self._kwargs())
        except HttpError as exc:
            if exc.status in (401, 403):
                raise Inaccessible("page protégée (connexion requise ou accès refusé)") from exc
            raise
        if "html" not in res.headers.get("content-type", "html"):
            raise Inaccessible("contenu non HTML")
        html = res.text()
        if any(m in html.lower() for m in CAPTCHA_MARKERS):
            raise Inaccessible("protection anti-robot (CAPTCHA) : non contournée")
        return extract_text(html)
