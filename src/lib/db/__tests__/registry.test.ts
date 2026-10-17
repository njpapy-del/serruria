// Registre, journal, réglages, historiques — PostgreSQL embarqué (PGlite), données fictives.
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { migrateUp } from "../migrate";
import { insertRun, updateOpportunityStatus, upsertOpportunity, validateOpportunity, validateRun, ValidationError } from "../radarRepo";
import { costs, etatEffectif, getSettings, insertRunSources, journal, listSources, overview, opportunityEvents, putSettings, setSourceEnabled, sourceEvents, validateSettings } from "../registryRepo";
import type { Sql } from "../sql";

let sql: Sql;
beforeEach(async () => {
  const db = new PGlite();
  sql = async (text, params = []) => (await db.query(text, params)).rows as Record<string, unknown>[];
  await migrateUp(sql);
});

const NOW = new Date("2026-10-17T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

describe("état effectif d'une source", () => {
  const base = { etat_base: "ACTIVE", enabled: true, id: "bluesky" };
  it("ACTIVE seulement après un succès récent (< 24 h)", () => {
    expect(etatEffectif(base, { status: "SUCCESS_NO_RESULTS", started_at: hoursAgo(1) }, hoursAgo(1), NOW)).toBe("ACTIVE");
    expect(etatEffectif(base, { status: "SUCCESS_NO_RESULTS", started_at: hoursAgo(30) }, hoursAgo(30), NOW)).toBe("IDLE");
    expect(etatEffectif(base, null, null, NOW)).toBe("IDLE");
  });
  it("ERROR, NOT_CONFIGURED, PAUSED, et jamais ACTIVE pour une source interdite", () => {
    expect(etatEffectif(base, { status: "SEARCH_FAILED", started_at: hoursAgo(1) }, hoursAgo(2), NOW)).toBe("ERROR");
    expect(etatEffectif(base, { status: "SOURCE_NOT_CONFIGURED", started_at: hoursAgo(1) }, null, NOW)).toBe("NOT_CONFIGURED");
    expect(etatEffectif({ ...base, enabled: false }, null, hoursAgo(1), NOW)).toBe("PAUSED");
    expect(etatEffectif({ etat_base: "ACCESS_NOT_PERMITTED", enabled: true, id: "pagesjaunes" }, { status: "SUCCESS_NO_RESULTS", started_at: hoursAgo(1) }, hoursAgo(1), NOW)).toBe("ACCESS_NOT_PERMITTED");
  });
});

describe("activation / désactivation", () => {
  it("historise les changements et refuse les sources interdites ou internes", async () => {
    await setSourceEnabled(sql, "brave_search", false);
    await setSourceEnabled(sql, "brave_search", true);
    expect((await sourceEvents(sql)).map((e) => e.nouveau)).toEqual(["ACTIVÉE", "PAUSED"]);
    await expect(setSourceEnabled(sql, "pagesjaunes", true)).rejects.toThrow(ValidationError);
    await expect(setSourceEnabled(sql, "search_console", true)).rejects.toThrow(ValidationError);
    await expect(setSourceEnabled(sql, "inconnue", true)).rejects.toThrow(ValidationError);
  });
});

async function runWith(id: string, startedAt: string, sources: Record<string, Record<string, unknown>>, status = "SUCCESS_NO_RELEVANT_LEADS") {
  const run = validateRun({ run_id: id, mode: "assiste", started_at_utc: startedAt, status, sources });
  await insertRun(sql, run);
  await insertRunSources(sql, id, startedAt, sources as never);
}

describe("journal par source et registre", () => {
  it("enregistre nos requêtes et les métriques, calcule l'état et les coûts", async () => {
    await runWith("r1", hoursAgo(2), {
      bluesky: { status: "SUCCESS_NO_RELEVANT_LEADS", planned: 10, sent: 10, succeeded: 10, failed: 0, results: 5, relevant: 0, eliminated: { NON_PERTINENT: 5 }, queries: ["porte claquée"], duration_ms: 1800, cost_usd: 0 },
      brave_search: { status: "SEARCH_FAILED", planned: 6, sent: 6, succeeded: 0, failed: 6, results: 0, relevant: 0, error_kind: "authentification", queries: ['"je cherche un serrurier" Paris'], cost_usd: 0.03 },
    });
    const j = await journal(sql);
    const b = j.find((r) => r.source_id === "bluesky")!;
    expect(b).toMatchObject({ planned: 10, attempted: 10, rejected: 5, qualified: 0, duration_ms: 1800, cost_method: "gratuit" });
    expect(b.queries).toEqual(["porte claquée"]);
    expect(j.find((r) => r.source_id === "brave_search")!.cost_method).toContain("0,005");
    const src = await listSources(sql, NOW);
    expect(src.find((s) => s.id === "bluesky")!.etat).toBe("ACTIVE");
    expect(src.find((s) => s.id === "brave_search")!.etat).toBe("ERROR");
    expect(src.find((s) => s.id === "pagesjaunes")!.etat).toBe("ACCESS_NOT_PERMITTED");
    expect(src.find((s) => s.id === "alertes_rss")!.etat).toBe("NOT_CONFIGURED");
    const c = await costs(sql);
    expect(c.parSource.find((p) => p.source_id === "brave_search")!.coutParPertinente).toBeNull(); // non calculable
    expect(c.tauxFauxPositifs).toBeNull(); // aucune demande examinée
  });

  it("vue d'ensemble : passages attendus/exécutés, taux de réussite, moteur arrêté", async () => {
    await putSettings(sql, validateSettings({ expected_interval_minutes: 60 }));
    await runWith("a", hoursAgo(5), { bluesky: { status: "SUCCESS_NO_RESULTS", sent: 10 } }, "SUCCESS_NO_RESULTS");
    await runWith("b", hoursAgo(3), { bluesky: { status: "SEARCH_FAILED", sent: 10, failed: 10 } }, "SEARCH_FAILED");
    const o = await overview(sql, NOW);
    expect(o.passages24h).toEqual({ attendus: 24, executes: 2, reussis: 1 });
    expect(o.tauxReussite).toBe(0.5);
    expect(o.moteurArrete).toBe(true); // 3 h sans passage > 2 × 60 min
  });
});

describe("réglages", () => {
  it("valide strictement et plafonne Brave au crédit gratuit", () => {
    expect(validateSettings({ brave_max_queries_per_day: 24, departements: ["93", "75", "93"] })).toEqual({ brave_max_queries_per_day: 24, departements: ["75", "93"] });
    expect(() => validateSettings({ brave_max_queries_per_day: 500 })).toThrow(ValidationError);
    expect(() => validateSettings({ departements: ["69"] })).toThrow(ValidationError);
    expect(() => validateSettings({ pirate: 1 })).toThrow(ValidationError);
    expect(() => validateSettings({ alerts_enabled: "oui" })).toThrow(ValidationError);
  });
  it("sont relus avec l'état d'activation des sources", async () => {
    await putSettings(sql, validateSettings({ notify_min_score: 60 }));
    await setSourceEnabled(sql, "brave_search", false);
    const s = await getSettings(sql);
    expect(s.notify_min_score).toBe(60);
    expect(s.sources_enabled.brave_search).toBe(false);
    expect("pagesjaunes" in s.sources_enabled).toBe(false); // non activable : jamais transmise au robot
  });
});

describe("historique et faux positifs", () => {
  it("historise les actions commerciales et calcule le taux de faux positifs", async () => {
    for (const k of ["k1", "k2"]) {
      await upsertOpportunity(sql, validateOpportunity({ source_id: "bluesky", key: k, detected_at: new Date().toISOString(), classe: "DEMANDE_PROBABLE", motifs: ["Urgence : urgent"] }));
    }
    const [o1, o2] = await sql("SELECT id FROM opportunities ORDER BY id");
    await updateOpportunityStatus(sql, Number(o1.id), "a_contacter");
    await updateOpportunityStatus(sql, Number(o1.id), "contactee");
    await updateOpportunityStatus(sql, Number(o2.id), "non_pertinente");
    expect((await opportunityEvents(sql, Number(o1.id))).map((e) => e.nouveau)).toEqual(["contactee", "a_contacter"]);
    const c = await costs(sql);
    expect(c.tauxFauxPositifs).toBe(0.5);
    expect(c.demandesConfirmees).toBe(1);
    const [m] = await sql("SELECT motifs FROM opportunities WHERE id = $1", [o1.id]);
    expect(m.motifs).toEqual(["Urgence : urgent"]);
  });
});
