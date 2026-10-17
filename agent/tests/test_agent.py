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
from lead_radar_agent.sources.base import RawItem, SourceDisabled, SourceNotConfigured, SourceResult
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
        base = {**CFG["sources"]["brave_search"], "enabled": False, "approved_by_owner": False, "monthly_budget_usd": 4.5}
        with self.assertRaises(SourceDisabled):
            brave.check_enabled(base, "cle")
        with self.assertRaises(SourceDisabled):
            brave.check_enabled({**base, "enabled": True}, "cle")
        with self.assertRaises(SourceDisabled):
            brave.check_enabled({**base, "enabled": True, "approved_by_owner": True}, None)
        with self.assertRaises(SourceDisabled):
            brave.check_enabled({**base, "enabled": True, "approved_by_owner": True, "monthly_budget_usd": 0}, "cle")
        brave.check_enabled({**base, "enabled": True, "approved_by_owner": True}, "cle")  # tout est réuni

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
        self.assertEqual(lead_subject({**result(), "niveauUrgence": "ELEVEE"}), "[NOUVELLE DEMANDE SERRURERIE] — Aubervilliers (93) — URGENCE ÉLEVÉE")
        self.assertEqual(lead_subject({**result(), "niveauUrgence": "DEVIS", "localisation": None}), "[NOUVELLE DEMANDE SERRURERIE] — Zone inconnue — DEMANDE DE DEVIS")

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

    def test_un_email_par_demande_les_plus_urgentes_d_abord(self):
        mailer = FakeMailer()
        items = [self.item("A", "1"), self.item("B", "2")]
        res = {"A": {**result(key="id:a"), "niveauUrgence": "DEVIS"}, "B": {**result(key="id:b"), "niveauUrgence": "ELEVEE"}}
        rep, _ = self.run_with(items, res, mailer)
        self.assertEqual(len(mailer.sent), 2)
        self.assertEqual(rep.notifications_sent, 2)
        self.assertIn("URGENCE ÉLEVÉE", mailer.sent[0][0])
        self.assertIn("DEMANDE DE DEVIS", mailer.sent[1][0])

    def test_surveillance_n_inclut_pas_de_reponse(self):
        mailer = FakeMailer()
        self.run_with([self.item("A")], {"A": result()}, mailer, mode="surveillance")
        self.assertNotIn("Réponse proposée", mailer.sent[0][1])

    def test_erreur_de_recherche_est_une_erreur(self):
        state = State(Path("/dev/null"))
        collected = {"bluesky": SourceResult("bluesky", queries=["q"], errors=["network"])}
        rep = run_once(mode="assiste", cfg=CFG, state=state, env={}, now=NOW, mailer=None, collected=collected, qualify_fn=fake_qualify({}))
        self.assertTrue(rep.search_failed)
        self.assertEqual(rep.sources["bluesky"]["status"], "SEARCH_FAILED")
        self.assertEqual(rep.status, "SEARCH_FAILED")
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


class BraveComplianceTest(unittest.TestCase):
    def test_brave_ne_conserve_rien(self):
        state, mailer = State(Path("/dev/null")), FakeMailer()
        item = RawItem("brave_search", None, "https://exemple.invalid/b", "t", "A", NOW)
        for _ in range(2):
            collected = {"brave_search": SourceResult("brave_search", queries=["q"], items=[item, item])}
            rep = run_once(mode="assiste", cfg=CFG, state=state, env={}, now=NOW, mailer=mailer, collected=collected, qualify_fn=fake_qualify({"A": result(key="url:b")}))
            self.assertEqual(rep.duplicates, 1)  # doublon dans le passage seulement
        self.assertEqual(state.data["seen"], {})
        self.assertEqual(state.data["notified"], {})

    def test_brave_reserve_aux_passages_planifies(self):
        from lead_radar_agent.run import collect

        scfg = CFG["sources"]["brave_search"]
        slot = datetime(2026, 10, 16, 6, 30, tzinfo=timezone.utc)  # 8 h 30 à Paris, dans un créneau
        with self.assertRaises(SourceDisabled) as c:
            collect("brave_search", scfg, CFG, State(Path("/dev/null")), {"BRAVE_SEARCH_API_KEY": "k"}, slot, {"opener": opener_for([])})
        self.assertIn("passages planifiés", str(c.exception))
        with self.assertRaises(SourceNotConfigured):
            collect("brave_search", scfg, CFG, State(Path("/dev/null")), {}, slot, {"opener": opener_for([])})

    def test_brave_hors_creneau_ne_fait_aucun_appel(self):
        from lead_radar_agent.run import collect

        scfg = CFG["sources"]["brave_search"]
        hors = datetime(2026, 10, 16, 8, 30, tzinfo=timezone.utc)  # 10 h 30 à Paris
        with self.assertRaises(SourceDisabled) as c:
            collect("brave_search", scfg, CFG, State(Path("/dev/null")), {"BRAVE_SEARCH_API_KEY": "k", "RADAR_ALLOW_PAID": "true"}, hors, {"opener": opener_for([])})
        self.assertIn("créneaux", str(c.exception))

    def test_brave_dans_un_creneau_planifie(self):
        from lead_radar_agent.run import collect

        scfg = CFG["sources"]["brave_search"]
        slot = datetime(2026, 10, 16, 6, 30, tzinfo=timezone.utc)
        op = opener_for([FakeRes(body=b'{"web":{"results":[]}}')] * 10)
        res = collect("brave_search", scfg, CFG, State(Path("/dev/null")), {"BRAVE_SEARCH_API_KEY": "k", "RADAR_ALLOW_PAID": "true"}, slot, {"opener": op})
        self.assertEqual(len(op.calls), scfg["max_queries_per_run"])
        self.assertIsNone(res.skipped_reason)
        # moitié anneau prioritaire (départements d'abord), moitié anneau large (communes proches d'Aubervilliers d'abord)
        self.assertIn("Paris", res.lieux)
        self.assertIn("Aubervilliers", res.lieux)

    def test_extraits_brave_nettoyes(self):
        body = json.dumps({"web": {"results": [{"url": "https://x.test", "title": "L&#x27;astuce <strong>porte</strong>", "description": "<strong>Clé</strong> cassée"}]}}).encode()
        res = brave.search(["q"], api_key="k", budget_left_usd=1, cost_per_query=0.005, opener=opener_for([FakeRes(body=body)]))
        self.assertEqual((res.items[0].title, res.items[0].content), ("L'astuce porte", "Clé cassée"))

    def test_requetes_orientees_demandes(self):
        qs = Q.demand_queries(["93"], ["Aubervilliers"])
        self.assertIn('"je cherche un serrurier" Seine-Saint-Denis', qs)
        self.assertTrue(all('"' in q for q in qs))


class PlomberieEtCadenceTest(unittest.TestCase):
    def test_plomberie_comptee_jamais_notifiee(self):
        mailer = FakeMailer()
        r = {**result(key="id:plomb"), "classe": "HORS_PRESTATION", "classeBrute": "DEMANDE_CONFIRMEE", "metier": "plomberie"}
        item = RawItem("bluesky", "p1", "https://exemple.invalid/p1", "", "WC bouché", NOW)
        state = State(Path("/dev/null"))
        rep = run_once(mode="assiste", cfg=CFG, state=state, env={}, now=NOW, mailer=mailer,
                       collected={"bluesky": SourceResult("bluesky", queries=["q"], items=[item])}, qualify_fn=fake_qualify({"WC bouché": r}))
        self.assertEqual([s for s, _, _ in mailer.sent if "LEAD RADAR]" in s and "Synthèse" not in s], [])
        self.assertEqual(rep.by_metier["plomberie"]["demandes"], 1)
        self.assertEqual(rep.by_metier["plomberie"]["hors_prestation"], 1)
        self.assertEqual(state.daily("2026-10-16")["demandes_plomberie"], 1)

    def test_synthese_mesure_la_cadence(self):
        state, mailer = State(Path("/dev/null")), FakeMailer()
        for h in (17, 18, 20):  # 19 h, 20 h, 22 h à Paris
            t = datetime(2026, 10, 16, h, 7, tzinfo=timezone.utc)
            run_once(mode="assiste", cfg=CFG, state=state, env={}, now=t, mailer=mailer, collected={}, qualify_fn=fake_qualify({}))
        summary = [t for s, t, _ in mailer.sent if "Synthèse" in s][0]
        self.assertIn("écart maximal 60 min", summary)  # la synthèse part au 2e passage (20 h)
        self.assertIn("plomberie (non proposée, non notifiée)", summary)

    def test_requetes_plomberie_separees_et_minoritaires(self):
        qs = Q.demand_queries(["93"], [])
        plomb = [q for q in qs if "plombier" in q or "wc" in q or "fuite" in q]
        self.assertTrue(plomb)
        self.assertLess(len(plomb), len(qs) / 2)
        self.assertNotIn("wc bouché", Q.broad_queries(include_plomberie=False))


class NotificationReliabilityTest(unittest.TestCase):
    def mailer(self, responses):
        return Mailer("k", "radar@x.test", ["a@x.test"], http_kwargs={"opener": opener_for(responses), "sleep": lambda s: None})

    def test_echecs_types(self):
        cases = [(401, "permanent", "auth"), (403, "permanent", "auth"), (422, "refused", "invalid"), (429, "temporary", "quota")]
        for status, kind, code in cases:
            with self.assertRaises(NotifyError) as c:
                self.mailer([http_error(status)] * 3).send("s", "t", "k")
            self.assertEqual((c.exception.kind, c.exception.code), (kind, code), status)

    def test_erreur_temporaire_retentee_puis_acceptee(self):
        m = self.mailer([http_error(503), FakeRes(body=b'{"id":"m1"}')])
        self.assertEqual(m.send("s", "t", "k"), "m1")

    def test_tentatives_limitees(self):
        op = opener_for([http_error(503)] * 10)
        m = Mailer("k", "radar@x.test", ["a@x.test"], http_kwargs={"opener": op, "sleep": lambda s: None})
        with self.assertRaises(NotifyError):
            m.send("s", "t", "k")
        self.assertEqual(len(op.calls), 3)

    def test_reponse_sans_identifiant_n_est_pas_un_succes(self):
        with self.assertRaises(NotifyError):
            self.mailer([FakeRes(body=b"{}")]).send("s", "t", "k")

    def test_etat_de_livraison(self):
        m = self.mailer([FakeRes(body=b'{"id":"m1"}'), FakeRes(body=b'{"last_event":"delivered"}')])
        m.send("s", "t", "k")
        self.assertEqual(m.check_deliveries(wait_seconds=0, sleep=lambda s: None), {"delivered": 1})
        m2 = self.mailer([FakeRes(body=b'{"id":"m2"}'), http_error(500)])
        m2.send("s", "t", "k")
        self.assertEqual(m2.check_deliveries(wait_seconds=0, sleep=lambda s: None), {"unknown": 1})


class HealthTest(unittest.TestCase):
    def run_health(self, collected, results=None):
        rep = run_once(mode="assiste", cfg=CFG, state=State(Path("/dev/null")), env={}, now=NOW, mailer=FakeMailer(),
                       collected=collected, qualify_fn=fake_qualify(results or {}))
        return rep

    def item(self, t):
        return RawItem("bluesky", t, f"https://exemple.invalid/{t}", "", t, NOW)

    def test_etats_distincts(self):
        self.assertEqual(self.run_health({}).status, "SOURCE_NOT_RUN")
        self.assertEqual(self.run_health({"bluesky": SourceResult("bluesky", queries=["q"])}).status, "SUCCESS_NO_RESULTS")
        self.assertEqual(self.run_health({"bluesky": SourceResult("bluesky", queries=["q"], errors=["network"])}).status, "SEARCH_FAILED")
        rep = self.run_health({"bluesky": SourceResult("bluesky", queries=["q"], items=[self.item("A")])}, {"A": result("NON_PERTINENT", key="id:a")})
        self.assertEqual(rep.status, "SUCCESS_NO_RELEVANT_LEADS")
        self.assertEqual(rep.sources["bluesky"]["eliminated"], {"NON_PERTINENT": 1})
        rep = self.run_health({"bluesky": SourceResult("bluesky", queries=["q"], items=[self.item("B")])}, {"B": result(key="id:b")})
        self.assertEqual(rep.status, "SUCCESS_WITH_LEADS")
        rep = self.run_health({"bluesky": SourceResult("bluesky", queries=["q1", "q2"], items=[self.item("C")], errors=["timeout"])}, {"C": result("NON_PERTINENT", key="id:c")})
        self.assertEqual(rep.status, "PARTIAL_SUCCESS")

    def test_notification_impossible_signalee(self):
        rep = run_once(mode="assiste", cfg=CFG, state=State(Path("/dev/null")), env={}, now=NOW, mailer=FakeMailer(fail=True),
                       collected={"bluesky": SourceResult("bluesky", queries=["q"], items=[self.item("A")])}, qualify_fn=fake_qualify({"A": result()}))
        self.assertTrue(rep.notification_impossible)
        self.assertEqual(rep.notif["permanent"], 1)
        self.assertEqual(rep.status, "EMAIL_FAILED")

    def test_devis_et_recherche_pro_notifies_mais_regroupes(self):
        mailer = FakeMailer()
        items = [self.item("D"), self.item("R")]
        res = {"D": {**result("DEMANDE_DEVIS", key="id:d"), "niveauUrgence": "DEVIS"}, "R": {**result("RECHERCHE_PRO", key="id:r"), "niveauUrgence": "NON_URGENTE"}}
        rep = run_once(mode="assiste", cfg=CFG, state=State(Path("/dev/null")), env={}, now=NOW, mailer=mailer,
                       collected={"bluesky": SourceResult("bluesky", queries=["q"], items=items)}, qualify_fn=fake_qualify(res))
        self.assertEqual(rep.notifications_sent, 2)
        self.assertEqual(len([s for s, _, _ in mailer.sent if s.startswith("[NOUVELLE DEMANDE SERRURERIE]")]), 2)

    def test_prestation_a_confirmer_jamais_notifiee(self):
        mailer = FakeMailer()
        r = {**result(key="id:pac"), "classe": "PRESTATION_A_CONFIRMER", "classeBrute": "DEMANDE_CONFIRMEE", "metier": "plomberie"}
        rep = run_once(mode="assiste", cfg=CFG, state=State(Path("/dev/null")), env={}, now=NOW, mailer=mailer,
                       collected={"bluesky": SourceResult("bluesky", queries=["q"], items=[self.item("P")])}, qualify_fn=fake_qualify({"P": r}))
        self.assertEqual(rep.notifications_sent, 0)
        self.assertEqual(rep.by_metier["plomberie"]["a_confirmer"], 1)


class JournalTest(unittest.TestCase):
    def test_journal_persiste_metriques_sans_contenu(self):
        state = State(Path("/dev/null"))
        item = RawItem("bluesky", "j1", "https://exemple.invalid/j1", "", "Je suis bloqué à Pantin", NOW - timedelta(minutes=42))
        rep = run_once(mode="assiste", cfg=CFG, state=state, env={}, now=NOW, mailer=FakeMailer(),
                       collected={"bluesky": SourceResult("bluesky", queries=["porte claquée"], items=[item], planned=2)},
                       qualify_fn=fake_qualify({"Je suis bloqué à Pantin": result(key="id:j1")}))
        rec = state.data["runs"][-1]
        self.assertEqual(rec["run_id"], rep.run_id)
        for k in ("started_at_utc", "started_at_paris", "finished_at_utc", "status", "sources", "alerts"):
            self.assertIn(k, rec)
        src = rec["sources"]["bluesky"]
        self.assertEqual((src["planned"], src["sent"], src["succeeded"], src["failed"], src["results"], src["relevant"]), (2, 1, 1, 0, 1, 1))
        self.assertEqual(src["delai_publication_detection_min"], {"median": 42, "max": 42})
        dump = json.dumps(state.data)
        self.assertNotIn("exemple.invalid", dump)
        self.assertNotIn("Pantin", dump)

    def test_non_configuree_vs_non_lancee(self):
        cfg = json.loads(json.dumps(CFG))
        cfg["sources"]["bluesky"]["enabled"] = False  # aucun appel réseau dans les tests
        state = State(Path("/dev/null"))
        rep = run_once(mode="assiste", cfg=cfg, state=state, env={}, now=NOW, mailer=None)
        self.assertEqual(rep.sources["bluesky"]["status"], "SOURCE_NOT_RUN")
        self.assertEqual(rep.sources["alertes_rss"]["status"], "SOURCE_NOT_CONFIGURED")
        self.assertEqual(rep.sources["brave_search"]["status"], "SOURCE_NOT_CONFIGURED")

    def test_couverture_geographique(self):
        p, w = Q.geo_rings(["75", "77", "78", "91", "92", "93", "94", "95"])
        self.assertEqual(len(w), 1266)
        self.assertEqual(w[0], "Aubervilliers")
        self.assertEqual(p[:8], ["Paris", "Seine-et-Marne", "Yvelines", "Essonne", "Hauts-de-Seine", "Seine-Saint-Denis", "Val-de-Marne", "Val-d'Oise"])
        pairs, cur = Q.lieu_queries(w, 0, 5)
        self.assertEqual(len({lieu for _, lieu in pairs}), 5)  # 5 communes distinctes pour 5 requêtes
        self.assertTrue(all(q.endswith(lieu) for q, lieu in pairs))

    def test_requetes_concurrence_jamais_dans_le_radar(self):
        radar = set(Q.broad_queries()) | {q for q, _ in Q.lieu_queries(Q.geo_rings(["93"])[1], 0, 200)[0]}
        self.assertFalse(radar & set(Q.REQUETES_CONCURRENCE))


class GscTest(unittest.TestCase):
    def test_non_configure(self):
        from lead_radar_agent.gsc import GscNotConfigured, fetch_report

        with self.assertRaises(GscNotConfigured):
            fetch_report({})

    def test_erreur_remontee(self):
        from types import SimpleNamespace

        from lead_radar_agent.gsc import GscError, fetch_report

        fake = lambda *a, **k: SimpleNamespace(returncode=1, stdout="", stderr='{"error":"permission","message":"accès refusé"}')
        with self.assertRaises(GscError) as c:
            fetch_report({"GSC_SERVICE_ACCOUNT_JSON": "x", "GSC_PROPERTY": "sc-domain:x"}, runner=fake)
        self.assertIn("permission", str(c.exception))

    def test_email_du_rapport(self):
        from lead_radar_agent.gsc import report_email

        r = {"property": "sc-domain:serrurerielouisfils.com", "periode": {"debut": "2026-09-17", "fin": "2026-10-14", "note": "n"},
             "totaux": {"clics": 3, "impressions": 200, "ctr": 0.015, "positionMoyenne": 12.3},
             "requetes": [{"requete": "serrurier aubervilliers", "clics": 1, "impressions": 80, "ctr": 0.01, "position": 14.0}],
             "pages": [], "opportunites": [{"requete": "serrurier aubervilliers", "impressions": 80, "position": 14.0, "raison": "affiché au-delà de la 1re page"}]}
        subject, body = report_email(r)
        self.assertTrue(subject.startswith("[SEARCH CONSOLE]"))
        self.assertIn("Ce ne sont ni des appels ni des clients", body)


class HeartbeatTest(unittest.TestCase):
    def test_succes_et_echec(self):
        from lead_radar_agent.__main__ import heartbeat

        op = opener_for([FakeRes(), FakeRes(), FakeRes()])
        heartbeat({"HEALTHCHECK_PING_URL": "https://hc.test/abc"}, "SUCCESS_NO_RESULTS", {"opener": op})
        heartbeat({"HEALTHCHECK_PING_URL": "https://hc.test/abc"}, "SEARCH_FAILED", {"opener": op})
        heartbeat({"HEALTHCHECK_PING_URL": "https://hc.test/abc"}, "SOURCE_NOT_RUN", {"opener": op})
        self.assertEqual([c.full_url for c in op.calls], ["https://hc.test/abc", "https://hc.test/abc/fail", "https://hc.test/abc/fail"])
        heartbeat({}, "SUCCESS_NO_RESULTS", {"opener": opener_for([])})  # sans URL : aucun appel


class IngestTest(unittest.TestCase):
    def test_envoi_sans_brave_ni_texte(self):
        from lead_radar_agent.ingest import push

        state = State(Path("/dev/null"))
        items = [RawItem("bluesky", "b1", "https://bsky.app/profile/x.test/post/1", "", "B", NOW), RawItem("brave_search", None, "https://exemple.invalid/r", "t", "R", NOW)]
        collected = {"bluesky": SourceResult("bluesky", queries=["q"], items=items[:1]), "brave_search": SourceResult("brave_search", queries=["q"], items=items[1:])}
        rep = run_once(mode="assiste", cfg=CFG, state=state, env={}, now=NOW, mailer=FakeMailer(), collected=collected,
                       qualify_fn=fake_qualify({"B": result(key="id:b1"), "R": result(key="url:r")}))
        self.assertEqual([o["source_id"] for o in rep.opportunities], ["bluesky"])
        op = opener_for([FakeRes(body=b'{"ok":true}')])
        self.assertEqual(push({"RADAR_INGEST_URL": "https://site.test/api/radar/ingest", "RADAR_INGEST_TOKEN": "t" * 40}, rep, opener=op), "ok")
        sent = json.loads(op.calls[0].data)
        self.assertEqual([o["source_id"] for o in sent["opportunities"]], ["bluesky"])
        self.assertNotIn("queries", json.dumps(sent["run"]["sources"]))
        self.assertNotIn("exemple.invalid", json.dumps(sent))
        self.assertEqual(op.calls[0].get_header("Authorization"), "Bearer " + "t" * 40)

    def test_non_configure_et_erreur(self):
        from lead_radar_agent.ingest import push

        rep = run_once(mode="assiste", cfg=CFG, state=State(Path("/dev/null")), env={}, now=NOW, mailer=None, collected={}, qualify_fn=fake_qualify({}))
        self.assertEqual(push({}, rep), "not_configured")
        self.assertTrue(push({"RADAR_INGEST_URL": "https://site.test/i", "RADAR_INGEST_TOKEN": "t"}, rep, opener=opener_for([http_error(503)] * 3), sleep=lambda s: None).startswith("error"))


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
