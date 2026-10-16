// Tests du Lead Radar — uniquement des textes fictifs, aucune donnée client.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertValidPhone, defaultRadarConfig, type RadarConfig } from "../config";
import { ConnectorError, fetchFeed, parseFeed } from "../connectors/rss";
import { dedupeKeys, MemoryDedupeIndex, normalizeUrl } from "../dedupe";
import { locate } from "../geo";
import { processItems } from "../pipeline";
import { qualify, type RawItem } from "../qualify";
import { decideAction, DEFAULT_SOURCE_SETTINGS, generateResponse } from "../respond";
import { detectPlumbing, detectServices } from "../services";
import { getSource, SOURCES, type SourceDescriptor } from "../sources";
import { normalize } from "../text";

const NOW = new Date("2026-10-16T14:00:00Z");
const config = defaultRadarConfig();
const rss = getSource("alertes_rss")!;
const fixture = (name: string) => readFileSync(path.join(__dirname, "fixtures", name), "utf8");

function item(title: string, content = "", hoursAgo: number | null = 1, url: string | null = null): RawItem {
  return {
    sourceId: "alertes_rss",
    externalId: null,
    url,
    title,
    content,
    publishedAt: hoursAgo === null ? null : new Date(NOW.getTime() - hoursAgo * 3_600_000),
  };
}

// Source hypothétique qui autoriserait la publication automatique (aucune
// source réelle ne l'autorise aujourd'hui) — sert à tester le verrou complet.
const autoSource: SourceDescriptor = {
  ...rss,
  id: "source_test_auto",
  reponsePublique: { automatiseeAutorisee: true, manuellePossible: true, note: "test" },
  identifiants: ["TEST_TOKEN"],
};

describe("configuration", () => {
  it("reprend le numéro professionnel du site et les 8 départements", () => {
    expect(config.phoneDisplay).toBe("01 85 50 02 70");
    expect(config.departements).toEqual(["75", "77", "78", "91", "92", "93", "94", "95"]);
    expect(config.base?.nom).toBe("Aubervilliers");
    expect(config.horaires).toBeNull();
    expect(config.rayonKm).toBeNull();
  });

  it("refuse l'ancien numéro 07 54 47 12 50", () => {
    expect(() => assertValidPhone({ ...config, phoneDisplay: "07 54 47 12 50" })).toThrow();
    expect(() => assertValidPhone(config)).not.toThrow();
  });
});

describe("localisation", () => {
  it.each([
    ["Porte claquée à Créteil", "Créteil", "94"],
    ["serrurier 94000", "Créteil", "94"],
    ["Bloqué à Saint-Denis", "Saint-Denis", "93"],
    ["porte bloquée Paris 11e", "Paris", "75"],
    ["clé perdue 75011", "Paris", "75"],
    ["urgent Saint-Maur-des-Fossés", "Saint-Maur-des-Fossés", "94"],
  ])("%s → %s (%s)", (text, nom, dept) => {
    const loc = locate(text);
    expect(loc.kind).toBe("commune");
    if (loc.kind === "commune") {
      expect(loc.commune.nom).toBe(nom);
      expect(loc.commune.departement).toBe(dept);
    }
  });

  it("reconnaît un département seul", () => {
    expect(locate("je cherche un serrurier dans le Val-de-Marne")).toMatchObject({ kind: "departement", departement: "94" });
    expect(locate("serrurier dans le 93 svp")).toMatchObject({ kind: "departement", departement: "93" });
  });

  it("détecte une demande hors Île-de-France et une localisation inconnue", () => {
    expect(locate("porte claquée Lyon 69003").kind).toBe("hors_idf");
    expect(locate("ma porte est claquée").kind).toBe("inconnue");
  });
});

describe("besoins", () => {
  it("détecte les prestations précises avant le besoin générique", () => {
    const ids = detectServices(normalize("Clé cassée dans la serrure, besoin d'un serrurier")).map((s) => s.id);
    expect(ids).toContain("cle_cassee");
    expect(ids).not.toContain("serrurier_generique");
  });

  it("garde le besoin générique s'il est seul", () => {
    expect(detectServices(normalize("quelqu'un connaît un bon serrurier ?")).map((s) => s.id)).toEqual(["serrurier_generique"]);
  });
});

describe("qualification", () => {
  it("classe CRITIQUE une vraie demande urgente, récente et dans la zone", () => {
    const q = qualify(item("Je suis bloqué dehors à Créteil", "porte claquée, urgent svp", 0.5), rss, config, NOW);
    expect(q.kind).toBe("demande");
    expect(q.categorie).toBe("CRITIQUE");
    expect(q.score).toBe(q.lignes.reduce((s, l) => s + l.points, 0));
    expect(q.lignes.map((l) => l.critere)).toEqual(["Urgence", "Localisation", "Prestation", "Récence", "Source"]);
  });

  it("écarte une publicité de concurrent", () => {
    const q = qualify(item("Serrurier Paris 24h/24", "Nos serruriers, devis gratuit, appelez-nous"), rss, config, NOW);
    expect(q.kind).toBe("annonce_pro");
    expect(q.categorie).toBe("NON_PERTINENT");
  });

  it("écarte un article de presse et un annuaire", () => {
    expect(qualify(item("Arnaque au serrurier à Paris", "Selon l'enquête, un serrurier a été condamné"), rss, config, NOW).categorie).toBe("NON_PERTINENT");
    expect(qualify(item("Serrurier Créteil", "porte claquée", 1, "https://www.pagesjaunes.fr/annuaire/creteil-94/serruriers"), rss, config, NOW).kind).toBe("annuaire");
  });

  it("écarte une demande trop ancienne", () => {
    const q = qualify(item("Je cherche un serrurier à Créteil", "porte claquée", 24 * 40), rss, config, NOW);
    expect(q.categorie).toBe("NON_PERTINENT");
  });

  it("classe HORS_ZONE une demande à Lyon", () => {
    expect(qualify(item("Je cherche un serrurier", "porte claquée 69003 Lyon"), rss, config, NOW).categorie).toBe("HORS_ZONE");
  });

  it("garde À VÉRIFIER une demande sans localisation", () => {
    expect(qualify(item("Je cherche un serrurier", "ma porte est claquée"), rss, config, NOW).categorie).toBe("A_VERIFIER");
  });

  it("applique le rayon prioritaire seulement s'il est renseigné", () => {
    const loin = item("Je cherche un serrurier à Provins", "clé cassée");
    const sansRayon = qualify(loin, rss, config, NOW);
    const avecRayon = qualify(loin, rss, { ...config, rayonKm: 20 } as RadarConfig, NOW);
    expect(sansRayon.lignes[1].points).toBe(25);
    expect(avecRayon.lignes[1].points).toBe(15);
  });
});

describe("déduplication", () => {
  it("normalise les URL (redirection Google, paramètres de suivi, www)", () => {
    expect(
      normalizeUrl("https://www.google.com/url?rct=j&url=https://www.forum.exemple.fr/t/1%3Futm_source%3Dx%26page%3D2&ct=ga")
    ).toBe("https://forum.exemple.fr/t/1?page=2");
  });

  it("repère un doublon par URL et par texte", async () => {
    const index = new MemoryDedupeIndex();
    const a = item("Je cherche un serrurier à Créteil", "porte claquée depuis ce matin, urgent", 1, "https://forum.exemple.fr/t/1");
    const memeUrl = { ...a, url: "https://www.forum.exemple.fr/t/1/?utm_source=alert" };
    const memeTexte = { ...a, url: "https://autre.exemple.fr/repost" };
    await index.remember(dedupeKeys(a));
    expect(await index.findExisting(dedupeKeys(memeUrl))).toMatch(/^url:/);
    expect(await index.findExisting(dedupeKeys(memeTexte))).toMatch(/^txt:/);
  });
});

describe("réponses", () => {
  const q = qualify(item("Je suis bloqué dehors à Créteil", "porte claquée urgent", 0.5), rss, config, NOW);

  it("propose le 01 85 50 02 70, jamais l'ancien numéro, sans prix ni délai promis", () => {
    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      const text = generateResponse(q, config, seed);
      expect(text).toContain("01 85 50 02 70");
      expect(text).not.toMatch(/07 ?54|0754/);
      expect(text).toContain("Serrurerie Louis & Fils");
      expect(text).not.toMatch(/€|\d+ ?min|garanti|immédiat|24h/i);
      expect(text).toContain("Créteil");
    }
  });

  it("varie le texte selon la demande", () => {
    const texts = new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map((s) => generateResponse(q, config, s)));
    expect(texts.size).toBeGreaterThan(1);
  });
});

describe("décision d'action", () => {
  const q = qualify(item("Je suis bloqué dehors à Créteil", "porte claquée urgent", 0.5), rss, config, NOW);

  it("ne fait rien par défaut (mode surveillance)", () => {
    expect(decideAction(q, rss, DEFAULT_SOURCE_SETTINGS, {}).action).toBe("aucune");
  });

  it("prépare seulement en mode assisté", () => {
    expect(decideAction(q, rss, { ...DEFAULT_SOURCE_SETTINGS, mode: "assiste" }, {}).action).toBe("preparer");
  });

  it("refuse la publication automatique si la source ne l'autorise pas", () => {
    const d = decideAction(q, rss, { mode: "automatique", conditionsVerifieesLe: "2026-10-16", testReussiLe: "2026-10-16", suspendue: false }, {});
    expect(d.action).toBe("preparer");
    expect(d.raisons.join(" ")).toContain("n'autorise pas");
  });

  it("aucune source réelle n'autorise aujourd'hui la publication automatique", () => {
    expect(SOURCES.filter((s) => s.reponsePublique.automatiseeAutorisee)).toEqual([]);
    expect(SOURCES.every((s) => s.messagePriveAutorise === false)).toBe(true);
  });

  it("exige vérification, test et identifiants avant de publier", () => {
    const base = { mode: "automatique" as const, conditionsVerifieesLe: "2026-10-16", testReussiLe: "2026-10-16", suspendue: false };
    expect(decideAction(q, autoSource, base, {}).action).toBe("preparer");
    expect(decideAction(q, autoSource, { ...base, testReussiLe: null }, { TEST_TOKEN: "x" }).action).toBe("preparer");
    expect(decideAction(q, autoSource, { ...base, conditionsVerifieesLe: null }, { TEST_TOKEN: "x" }).action).toBe("preparer");
    expect(decideAction(q, autoSource, base, { TEST_TOKEN: "x" }).action).toBe("publier");
    expect(decideAction(q, autoSource, { ...base, suspendue: true }, { TEST_TOKEN: "x" }).action).toBe("aucune");
  });

  it("ne répond jamais à un contenu non pertinent", () => {
    const pub = qualify(item("Serrurier Paris 24h/24", "Nos serruriers, devis gratuit"), rss, config, NOW);
    expect(decideAction(pub, rss, { ...DEFAULT_SOURCE_SETTINGS, mode: "assiste" }, {}).action).toBe("aucune");
  });
});

describe("connecteur RSS", () => {
  it("lit un flux Google Alerts (Atom) et suit la vraie URL", () => {
    const items = parseFeed(fixture("google-alerts.xml"));
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Je cherche un serrurier en urgence à Créteil");
    expect(items[0].content).toContain("je suis bloqué dehors à Créteil");
    expect(normalizeUrl(items[0].url!)).toBe("https://forum.exemple.fr/t/porte-claquee-creteil-123");
    expect(items[0].publishedAt?.toISOString()).toBe("2026-10-16T13:30:00.000Z");
  });

  it("lit un flux RSS 2.0 avec CDATA", () => {
    const [one] = parseFeed(fixture("rss2.xml"));
    expect(one).toMatchObject({ externalId: "demande-42", url: "https://communaute.exemple.fr/demande/42" });
    expect(one.content).toBe("J'ai besoin d'un serrurier, ma clé s'est cassée dans la serrure.");
  });

  it("rejette un contenu qui n'est pas un flux", () => {
    expect(() => parseFeed("<html><body>Erreur</body></html>")).toThrow(ConnectorError);
  });

  it("distingue quota, erreur serveur, erreur client et réseau", async () => {
    const respond = (status: number) => (async () => new Response("x", { status })) as unknown as typeof fetch;
    await expect(fetchFeed("https://x.test/f", { fetchImpl: respond(429) })).rejects.toMatchObject({ code: "quota", retryable: true });
    await expect(fetchFeed("https://x.test/f", { fetchImpl: respond(503) })).rejects.toMatchObject({ code: "http", retryable: true });
    await expect(fetchFeed("https://x.test/f", { fetchImpl: respond(404) })).rejects.toMatchObject({ code: "http", retryable: false });
    const offline = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(fetchFeed("https://x.test/f", { fetchImpl: offline })).rejects.toMatchObject({ code: "network" });
  });

  it("abandonne après le délai maximal", async () => {
    const slow = ((_: string, init: RequestInit) =>
      new Promise((_r, reject) => init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))))) as unknown as typeof fetch;
    await expect(fetchFeed("https://x.test/f", { fetchImpl: slow, timeoutMs: 20 })).rejects.toMatchObject({ code: "timeout" });
  });
});

describe("pipeline", () => {
  it("qualifie un flux, compte les doublons et ne prépare rien en surveillance", async () => {
    const items = parseFeed(fixture("google-alerts.xml"));
    const index = new MemoryDedupeIndex();
    const first = await processItems(items, { source: rss, config, index, now: NOW });
    expect(first.opportunities.map((o) => o.qualification.categorie)).toEqual(["CRITIQUE", "NON_PERTINENT"]);
    expect(first.opportunities.every((o) => o.reponseProposee === null)).toBe(true);

    const second = await processItems(items, { source: rss, config, index, now: NOW });
    expect(second.summary).toMatchObject({ lus: 2, doublons: 2, nouveaux: 0 });
  });

  it("prépare une réponse en mode assisté pour la vraie demande uniquement", async () => {
    const items = parseFeed(fixture("google-alerts.xml"));
    const { opportunities } = await processItems(items, {
      source: rss,
      config,
      index: new MemoryDedupeIndex(),
      now: NOW,
      settings: { ...DEFAULT_SOURCE_SETTINGS, mode: "assiste" },
    });
    expect(opportunities[0].decision.action).toBe("preparer");
    expect(opportunities[0].reponseProposee).toContain("01 85 50 02 70");
    expect(opportunities[1].reponseProposee).toBeNull();
  });
});

describe("classes commerciales", () => {
  const bsky = getSource("bluesky")!;
  it.each([
    ["Je cherche un serrurier à Créteil", "porte claquée", 1, null, "DEMANDE_CONFIRMEE"],
    ["Serrurier dans le Val-de-Marne ?", "ma porte est claquée svp", 1, null, "DEMANDE_PROBABLE"],
    ["Je cherche un serrurier à Créteil", "porte claquée", 24 * 40, null, "DEMANDE_ANCIENNE"],
    ["Arnaque au serrurier", "Selon l'enquête, un serrurier a été condamné", 1, null, "CONTENU_INFORMATIF"],
    ["Serrurier Créteil", "porte claquée", 1, "https://www.pagesjaunes.fr/annuaire/creteil-94/serruriers", "ANNUAIRE"],
    ["Serrurier Paris 24h/24", "Nos serruriers, devis gratuit", 1, null, "CONCURRENT_PUBLICITE"],
    ["Je cherche un serrurier", "porte claquée 69003 Lyon", 1, null, "HORS_IDF"],
    ["Je cherche un serrurier", "ma porte est claquée", 1, null, "A_VERIFIER"],
    ["Mon serrurier a fait faillite", "il a mis la clé sous la porte", 1, null, "A_VERIFIER"],
    ["Belle journée à Paris", "rien à voir", 1, null, "NON_PERTINENT"],
  ])("%s / %s → %s", (title, content, hours, url, classe) => {
    expect(qualify(item(title as string, content as string, hours as number, url as string | null), bsky, config, NOW).classe).toBe(classe);
  });

  it("marque l'urgence séparément de la classe", () => {
    expect(qualify(item("Je cherche un serrurier à Créteil", "clé cassée, urgent"), bsky, config, NOW).urgente).toBe(true);
    expect(qualify(item("Je cherche un serrurier à Créteil", "devis changement de serrure"), bsky, config, NOW).urgente).toBe(false);
  });

  it("Bluesky n'autorise pas les réponses automatiques", () => {
    expect(bsky.reponsePublique.automatiseeAutorisee).toBe(false);
  });
});

describe("formulations courantes", () => {
  it.each([
    ["ma porte est claquée", "porte_claquee"],
    ["la porte s'est refermée derrière moi", "porte_claquee"],
    ["porte fermée à clé et plus de clé", "porte_bloquee"],
  ])("%s → %s", (text, id) => {
    expect(detectServices(normalize(text))[0].id).toBe(id);
  });
});

describe("cas réels observés sur Brave (2026-10-16), reformulés", () => {
  const brave = getSource("brave_search")!;
  it.each([
    ["Serrurerie à Vitry-sur-Seine (94) - AlloVoisins", "Je travaille sur la région parisienne · Dernier avis : 5/5", "https://www.allovoisins.com/v/serrurerie/vitry-sur-seine", "ANNUAIRE"],
    ["Porte claquée avec les clés à l'intérieur — quelles techniques marchent vraiment ?", "Astuce : si la porte a un joint", "https://blog.exemple.fr/porte", "CONTENU_INFORMATIF"],
    ["Clé cassée dans la serrure : les bons gestes", "Un coup de lubrifiant sec", "https://depannage.exemple.fr/cle", "CONTENU_INFORMATIF"],
    ["Porte claquée et facture à 1 400 euros : qui doit payer le serrurier ?", "Maître X, avocat", "https://avocat.exemple.fr/article", "CONTENU_INFORMATIF"],
  ])("%s → %s", (title, content, url, classe) => {
    expect(qualify(item(title, content, 24 * 10, url), brave, config, NOW).classe).toBe(classe);
  });

  it("une vraie demande reste une demande", () => {
    expect(qualify(item("Je cherche un serrurier à Vitry-sur-Seine", "ma clé est cassée dans la serrure, urgent"), brave, config, NOW).classe).toBe("DEMANDE_CONFIRMEE");
  });
});

describe("plomberie (catalogue distinct, non proposée comme prospect)", () => {
  const bsky = getSource("bluesky")!;

  it.each([
    ["mes toilettes sont bouchées et l'eau déborde", "debouchage_wc", "debouchage"],
    ["évier bouché depuis hier", "debouchage_evier_lavabo", "debouchage"],
    ["un tuyau éclaté sous l'évier", "fuite_eau", "fuite"],
    ["dégât des eaux chez moi", "degat_des_eaux", "fuite"],
    ["le robinet est cassé", "robinetterie", "robinetterie_sanitaires"],
    ["la chasse d'eau qui fuit", "chasse_eau", "robinetterie_sanitaires"],
  ])("%s → %s", (text, id, famille) => {
    const [first] = detectPlumbing(normalize(text));
    expect(first).toMatchObject({ id, famille });
  });

  it("une vraie demande de plomberie est classée HORS_PRESTATION, sans réponse", () => {
    const q = qualify(item("Je cherche un plombier en urgence à Créteil", "WC bouché, ça déborde"), bsky, config, NOW);
    expect(q.metier).toBe("plomberie");
    expect(q.classe).toBe("HORS_PRESTATION");
    expect(q.classeBrute).toBe("DEMANDE_CONFIRMEE");
    expect(q.prestationProposee).toBe(false);
    expect(decideAction(q, bsky, { ...DEFAULT_SOURCE_SETTINGS, mode: "assiste" }, {}).action).toBe("aucune");
  });

  it("si la plomberie est activée, seul le débouchage devient un prospect", () => {
    const actif = { ...config, plomberie: { ...config.plomberie, prospectsActifs: true } };
    expect(qualify(item("Je cherche un plombier à Créteil", "évier bouché"), bsky, actif, NOW).classe).toBe("DEMANDE_CONFIRMEE");
    expect(qualify(item("Je cherche un plombier à Créteil", "robinet cassé"), bsky, actif, NOW).classe).toBe("HORS_PRESTATION");
  });

  it("utilise la zone plomberie (le 95 n'en fait pas partie)", () => {
    const actif = { ...config, plomberie: { ...config.plomberie, prospectsActifs: true } };
    expect(qualify(item("Je cherche un plombier à Argenteuil", "WC bouché"), bsky, actif, NOW).classe).toBe("HORS_IDF");
  });

  it("un besoin de serrurerie précis reste de la serrurerie même si l'eau est mentionnée", () => {
    const q = qualify(item("Je cherche un serrurier à Créteil", "porte claquée et j'ai laissé le robinet ouvert"), bsky, config, NOW);
    expect(q.metier).toBe("serrurerie");
    expect(q.classe).toBe("DEMANDE_CONFIRMEE");
  });

  it("un article de conseil en plomberie reste informatif", () => {
    expect(qualify(item("WC bouché : les bons gestes", "Astuce : bicarbonate et vinaigre"), bsky, config, NOW).classe).toBe("CONTENU_INFORMATIF");
  });
});
