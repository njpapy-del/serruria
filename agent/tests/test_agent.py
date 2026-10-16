"""Tests de l'agent — données fictives, aucun appel réseau réel."""

from __future__ import annotations

import io
import json
import tempfile
import unittest
import urllib.error
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

from lead_radar_agent import queries as Q
from lead_radar_agent.fetcher import Inaccessible, PoliteFetcher, extract_text
from lead_radar_agent.http import HttpError, request, request_with_retry
from lead_radar_agent.notify import Mailer, NotifyError, lead_subject
from lead_radar_agent.run import load_config, run_once
from lead_radar_agent.sources import bluesky, brave, rss
from lead_radar_agent.sources.base import RawItem, SourceDisabled, SourceResult
from lead_radar_agent.state import State, digest

AGENT = Path(__file__).resolve().parents[1]
NOW = datetime(2026, 10, 16, 14, 0, tzinfo=timezone.utc)
CFG = load_config(AGENT / "config.json")


class FakeRes:
    def __init__(self, status=200, body=b"", headers=None):
        self.status, self._body, self.headers = status, body, headers or {"Content-Type": "application/json"}

    def read(self, n=-1):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def opener_for(responses):
    """responses : liste de FakeRes ou d'exceptions, consommée dans l'ordre."""
    calls = []

    def opener(req, timeout):
        calls.append(req)
        r = responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return r

    opener.calls = calls
    return opener


def http_error(code):
    return urllib.error.HTTPError("https://x.test", code, "err", {}, io.BytesIO(b""))


def fake_qualify(results_by_text):
    def _q(items, **kw):
        return [results_by_text[i.content] for i in items]

    return _q


def result(classe="DEMANDE_CONFIRMEE", score=80, urgente=True, key="id:k1"):
    return {
        "dedupeKeys": [key, f"url:{key}"],
        "classe": classe,
        "categorie": "CRITIQUE",
        "categorieRaison": "test",
        "urgente": urgente,
        "score": score,
        "lignes": [{"critere": "Urgence", "points": 30, "max": 30, "raison": "test"}],
        "services": ["Porte claquée"],
        "localisation": {"nom": "Aubervilliers", "departement": "93"},
        "decision": {"action": "preparer", "raisons": []},
        "reponseProposee": "Bonjour, Serrurerie Louis & Fils … 01 85 50 02 70 …",
    }


class FakeMailer:
    def __init__(self, fail=False):
        self.sent, self.fail = [], fail

    def send(self, subject, text, key):
        if self.fail:
            raise NotifyError("Resend : http 500")
        self.sent.append((subject, text, key))
        return "id"


class QueriesTest(unittest.TestCase):
    def test_variantes_localisees_couvrent_les_8_departements(self):
        qs = Q.localized_queries(CFG["departements"], ["Aubervilliers"])
        for lieu in ["Paris", "Seine-et-Marne", "Yvelines", "Essonne", "Hauts-de-Seine", "Seine-Saint-Denis", "Val-de-Marne", "Val-d'Oise", "Aubervilliers"]:
            self.assertTrue(any(q.endswith(lieu) for q in qs), lieu)
        self.assertEqual(len(qs), len(set(qs)))

    def test_rotation_sans_repetition_dans_un_cycle(self):
        all_q = Q.broad_queries()
        seen, cursor = [], 0
        for _ in range(3):
            batch, cursor = Q.next_batch(all_q, cursor, 5)
            seen += batch
        self.assertEqual(len(seen), len(set(seen)))
        self.assertEqual(Q.next_batch(all_q, 0, 0), ([], 0))


class HttpTest(unittest.TestCase):
    def test_erreurs_typees(self):
        with self.assertRaises(HttpError) as c:
            request("https://x.test", opener=opener_for([http_error(429)]))
        self.assertEqual((c.exception.code, c.exception.retryable), ("quota", True))
        with self.assertRaises(HttpError) as c:
            request("https://x.test", opener=opener_for([http_error(404)]))
        self.assertEqual((c.exception.code, c.exception.retryable), ("http", False))
        with self.assertRaises(HttpError) as c:
            request("https://x.test", opener=opener_for([urllib.error.URLError("down")]))
        self.assertEqual(c.exception.code, "network")
        with self.assertRaises(HttpError):
            request("file:///etc/passwd")

    def test_reessaie_seulement_les_erreurs_temporaires(self):
        op = opener_for([http_error(503), FakeRes(body=b"{}")])
        request_with_retry("https://x.test", opener=op, sleep=lambda s: None)
        self.assertEqual(len(op.calls), 2)
        op = opener_for([http_error(404), FakeRes()])
        with self.assertRaises(HttpError):
            request_with_retry("https://x.test", opener=op, sleep=lambda s: None)
        self.assertEqual(len(op.calls), 1)


class StateTest(unittest.TestCase):
    def test_etat_sans_donnee_personnelle_et_persistant(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "s.json"
            s = State(path)
            s.remember(["url:https://exemple.invalid/post/1", "txt:abc"], NOW)
            s.mark_notified("url:https://exemple.invalid/post/1", NOW)
            s.save()
            raw = path.read_text("utf-8")
            self.assertNotIn("exemple.invalid", raw)
            s2 = State.load(path)
            self.assertEqual(s2.find_seen(["txt:abc"]), "txt:abc")
            self.assertTrue(s2.was_notified("url:https://exemple.invalid/post/1"))

    def test_retention(self):
        s = State(Path("/dev/null"))
        s.remember(["a"], NOW - timedelta(days=90))
        s.remember(["b"], NOW)
        s.purge(NOW, 60)
        self.assertIsNone(s.find_seen(["a"]))
        self.assertEqual(s.find_seen(["b"]), "b")

    def test_etat_corrompu(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "s.json"
            p.write_text("{pas du json")
            self.assertEqual(State.load(p).data["seen"], {})


class SourcesTest(unittest.TestCase):
    def test_bluesky_convertit_les_posts(self):
        body = json.dumps({"posts": [{"uri": "at://did:plc:x/app.bsky.feed.post/3abc", "author": {"handle": "exemple.bsky.social"},
                                      "record": {"text": "porte claquée", "createdAt": "2026-10-16T13:00:00Z"}}]}).encode()
        res = bluesky.search(["porte claquée"], now=NOW, lookback_hours=6, opener=opener_for([FakeRes(body=body)]))
        self.assertEqual(res.items[0].url, "https://bsky.app/profile/exemple.bsky.social/post/3abc")
        self.assertEqual(res.errors, [])

    def test_bluesky_erreur_n_est_pas_un_succes_vide(self):
        res = bluesky.search(["x"], now=NOW, lookback_hours=6, opener=opener_for([http_error(403)]), sleep=lambda s: None)
        self.assertEqual(res.errors, ["http"])
        self.assertEqual(res.items, [])

    def test_rss_google_alerts_et_rss2(self):
        atom = (AGENT.parent / "src/lib/radar/__tests__/fixtures/google-alerts.xml").read_text("utf-8")
        items = rss.parse_feed(atom)
        self.assertEqual(len(items), 2)
        self.assertTrue(items[0].url.startswith("https://forum.exemple.fr/"))
        self.assertIn("Créteil", items[0].title)
        rss2 = (AGENT.parent / "src/lib/radar/__tests__/fixtures/rss2.xml").read_text("utf-8")
        self.assertEqual(rss.parse_feed(rss2)[0].external_id, "demande-42")
        with self.assertRaises(HttpError):
            rss.parse_feed("<html>pas un flux")

    def test_brave_bloque_sans_accord_cle_ni_budget(self):
        base = dict(CFG["sources"]["brave_search"])
        with self.assertRaises(SourceDisabled):
            brave.check_enabled(base, "cle")
        with self.assertRaises(SourceDisabled):
            brave.check_enabled({**base, "enabled": True}, "cle")
        with self.assertRaises(SourceDisabled):
            brave.check_enabled({**base, "enabled": True, "approved_by_owner": True}, None)
        with self.assertRaises(SourceDisabled):
            brave.check_enabled({**base, "enabled": True, "approved_by_owner": True, "monthly_budget_usd": 0}, "cle")

    def test_brave_refuse_l_appel_qui_depasserait_le_budget(self):
        op = opener_for([FakeRes(body=b'{"web":{"results":[]}}')] * 5)
        res = brave.search(["a", "b", "c"], api_key="k", budget_left_usd=0.012, cost_per_query=0.005, opener=op)
        self.assertEqual(len(op.calls), 2)
        self.assertEqual(res.skipped_reason, "budget mensuel atteint")


class FetcherTest(unittest.TestCase):
    def test_respecte_robots_txt(self):
        robots = FakeRes(body=b"User-agent: *\nDisallow: /", headers={"Content-Type": "text/plain"})
        f = PoliteFetcher(min_delay=0, opener=opener_for([robots]))
        with self.assertRaises(Inaccessible):
            f.fetch("https://site.test/page")

    def test_ne_contourne_pas_captcha_ni_connexion(self):
        ok_robots = FakeRes(body=b"", headers={"Content-Type": "text/plain"})
        captcha = FakeRes(body=b"<html>Please complete the captcha</html>", headers={"Content-Type": "text/html"})
        f = PoliteFetcher(min_delay=0, opener=opener_for([ok_robots, captcha]))
        with self.assertRaises(Inaccessible):
            f.fetch("https://site.test/page")
        f = PoliteFetcher(min_delay=0, opener=opener_for([FakeRes(body=b"", headers={"Content-Type": "text/plain"}), http_error(403)]))
        with self.assertRaises(Inaccessible):
            f.fetch("https://site2.test/page")

    def test_extraction_texte(self):
        title, text = extract_text("<html><title>T</title><script>x()</script><body><nav>menu</nav><p>Ma porte est claquée</p></body></html>")
        self.assertEqual(title, "T")
        self.assertEqual(text, "Ma porte est claquée")

    def test_delai_entre_deux_requetes_sur_le_meme_site(self):
        slept = []
        clock = iter([0, 0, 1, 1, 1, 1]).__next__
        robots = FakeRes(body=b"", headers={"Content-Type": "text/plain"})
        page = FakeRes(body=b"<p>x</p>", headers={"Content-Type": "text/html"})
        f = PoliteFetcher(min_delay=5, opener=opener_for([robots, page]), sleep=slept.append, clock=clock)
        f.fetch("https://site.test/a")
        self.assertTrue(slept and slept[0] > 0)


class NotifyTest(unittest.TestCase):
    def test_objet_au_format_attendu(self):
        self.assertEqual(lead_subject(result()), "[LEAD RADAR] [URGENT] Porte claquée — Aubervilliers (93)")

    def test_bloque_l_ancien_numero(self):
        m = Mailer("k", "radar@x.test", ["a@x.test"])
        with self.assertRaises(NotifyError):
            m.send("s", "appelez le 07 54 47 12 50", "k")

    def test_envoi_resend_avec_idempotence(self):
        op = opener_for([FakeRes(body=b'{"id":"abc"}')])
        m = Mailer("k", "radar@x.test", ["a@x.test"], http_kwargs={"opener": op})
        self.assertEqual(m.send("s", "t 01 85 50 02 70", "lead-1"), "abc")
        self.assertEqual(op.calls[0].get_header("Idempotency-key"), "lead-1")
        self.assertEqual(op.calls[0].get_header("Authorization"), "Bearer k")


class RunTest(unittest.TestCase):
    def item(self, text, id_="1"):
        return RawItem("bluesky", id_, f"https://exemple.invalid/{id_}", "", text, NOW)

    def run_with(self, items, results, mailer, state=None, mode="assiste", now=NOW):
        state = state or State(Path("/dev/null"))
        collected = {"bluesky": SourceResult("bluesky", queries=["q"], items=items)}
        rep = run_once(mode=mode, cfg=CFG, state=state, env={}, now=now, mailer=mailer, collected=collected, qualify_fn=fake_qualify(results))
        return rep, state

    def test_notifie_une_seule_fois(self):
        mailer, items = FakeMailer(), [self.item("A")]
        rep, state = self.run_with(items, {"A": result()}, mailer)
        self.assertEqual(rep.notifications_sent, 1)
        self.assertIn("01 85 50 02 70", mailer.sent[0][1])
        rep2, _ = self.run_with(items, {"A": result()}, mailer, state=state)
        self.assertEqual(rep2.notifications_sent, 0)
        self.assertEqual(rep2.duplicates, 1)
        self.assertEqual(len(mailer.sent), 1)

    def test_echec_resend_est_signale_et_retente(self):
        items = [self.item("A")]
        rep, state = self.run_with(items, {"A": result()}, FakeMailer(fail=True))
        self.assertEqual(rep.notifications_sent, 0)
        self.assertTrue(rep.notification_errors)
        self.assertFalse(state.was_notified("id:k1"))

    def test_ne_notifie_pas_les_non_prospects(self):
        mailer = FakeMailer()
        items = [self.item("P", "1"), self.item("H", "2"), self.item("F", "3")]
        res = {"P": result("CONCURRENT_PUBLICITE", key="id:p"), "H": result("HORS_IDF", key="id:h"), "F": result(score=10, key="id:f")}
        rep, _ = self.run_with(items, res, mailer)
        self.assertEqual(mailer.sent, [])

    def test_regroupe_les_demandes_non_urgentes(self):
        mailer = FakeMailer()
        items = [self.item("A", "1"), self.item("B", "2")]
        res = {"A": result(urgente=False, key="id:a"), "B": result(urgente=False, key="id:b")}
        rep, _ = self.run_with(items, res, mailer)
        self.assertEqual(len(mailer.sent), 1)
        self.assertEqual(rep.notifications_sent, 2)
        self.assertTrue(mailer.sent[0][0].startswith("[LEAD RADAR] 2 demande(s)"))

    def test_surveillance_n_inclut_pas_de_reponse(self):
        mailer = FakeMailer()
        self.run_with([self.item("A")], {"A": result()}, mailer, mode="surveillance")
        self.assertNotIn("Réponse proposée", mailer.sent[0][1])

    def test_erreur_de_recherche_est_une_erreur(self):
        state = State(Path("/dev/null"))
        collected = {"bluesky": SourceResult("bluesky", queries=["q"], errors=["network"])}
        rep = run_once(mode="assiste", cfg=CFG, state=state, env={}, now=NOW, mailer=None, collected=collected, qualify_fn=fake_qualify({}))
        self.assertTrue(rep.search_failed)
        self.assertEqual(rep.sources["bluesky"]["status"], "error")
        self.assertEqual(state.source("bluesky")["consecutive_errors"], 1)

    def test_alerte_de_panne_apres_trois_echecs_une_fois_par_jour(self):
        state, mailer = State(Path("/dev/null")), FakeMailer()
        for _ in range(4):
            collected = {"bluesky": SourceResult("bluesky", queries=["q"], errors=["network"])}
            run_once(mode="assiste", cfg=CFG, state=state, env={}, now=NOW, mailer=mailer, collected=collected, qualify_fn=fake_qualify({}))
        errors = [s for s, _, _ in mailer.sent if "[ERREUR]" in s]
        self.assertEqual(len(errors), 1)

    def test_synthese_quotidienne_une_fois(self):
        state, mailer = State(Path("/dev/null")), FakeMailer()
        evening = datetime(2026, 10, 16, 19, 30, tzinfo=timezone.utc)  # 21 h 30 à Paris
        for _ in range(2):
            run_once(mode="assiste", cfg=CFG, state=state, env={}, now=evening, mailer=mailer, collected={}, qualify_fn=fake_qualify({}))
        self.assertEqual(len([s for s, _, _ in mailer.sent if "Synthèse" in s]), 1)

    def test_mode_automatique_refuse(self):
        with self.assertRaises(ValueError):
            run_once(mode="automatique", cfg=CFG, state=State(Path("/dev/null")), env={}, now=NOW, mailer=None, collected={})

    def test_journal_public_sans_url_ni_texte(self):
        rep, _ = self.run_with([self.item("Je suis bloqué à Aubervilliers")], {"Je suis bloqué à Aubervilliers": result()}, FakeMailer())
        log = rep.public_log()
        self.assertNotIn("exemple.invalid", log)
        self.assertNotIn("Aubervilliers", log)


class EndToEndQualifyTest(unittest.TestCase):
    """Utilise le vrai moteur TypeScript (nécessite node_modules)."""

    def test_moteur_reel_sur_donnees_fictives(self):
        from lead_radar_agent.qualify import qualify

        items = [self.item("Je cherche un serrurier en urgence à Aubervilliers, porte claquée !"),
                 self.item("Nos serruriers interviennent 24h/24, devis gratuit, appelez-nous.", "2")]
        out = qualify(items, source_id="bluesky", mode="assiste", now_iso=NOW.isoformat())
        self.assertEqual([o["classe"] for o in out], ["DEMANDE_CONFIRMEE", "CONCURRENT_PUBLICITE"])
        self.assertIn("01 85 50 02 70", out[0]["reponseProposee"])
        self.assertIsNone(out[1]["reponseProposee"])

    def item(self, text, id_="1"):
        return RawItem("bluesky", id_, f"https://exemple.invalid/{id_}", "", text, NOW - timedelta(minutes=10))


if __name__ == "__main__":
    unittest.main()
