// Tests base de données sur un vrai moteur PostgreSQL embarqué (PGlite) — aucune donnée réelle.
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { migrateDown, migrateUp } from "../migrate";
import {
  dashboard,
  insertIntervention,
  insertRun,
  keyHash,
  updateOpportunityStatus,
  upsertOpportunity,
  validateIntervention,
  validateOpportunity,
  validateRun,
  ValidationError,
} from "../radarRepo";
import type { Sql } from "../sql";

let sql: Sql;

beforeEach(async () => {
  const db = new PGlite();
  sql = async (text, params = []) => (await db.query(text, params)).rows as Record<string, unknown>[];
  await migrateUp(sql);
});

const run = (id: string, over: Record<string, unknown> = {}) => ({
  run_id: id,
  mode: "assiste",
  started_at_utc: new Date().toISOString(),
  finished_at_utc: new Date().toISOString(),
  status: "SUCCESS_NO_RESULTS",
  sources: { bluesky: { status: "SUCCESS_NO_RESULTS", sent: 10, results: 0, relevant: 0, cost_usd: 0, queries: ["porte claquée"] } },
  alerts: { generated: 0, accepted: 0 },
  ...over,
});

describe("migrations", () => {
  it("s'appliquent une seule fois et s'annulent proprement", async () => {
    expect(await migrateUp(sql)).toEqual([]);
    expect(await migrateDown(sql)).toBe("001_lead_radar");
    const tables = await sql("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1");
    expect(tables.map((t) => t.table_name)).toEqual(["schema_migrations"]);
    expect(await migrateUp(sql)).toEqual(["001_lead_radar"]);
  });
});

describe("passages", () => {
  it("enregistre les métriques, sans les textes de requêtes, de façon idempotente", async () => {
    await insertRun(sql, validateRun(run("abc123")));
    await insertRun(sql, validateRun(run("abc123")));
    const rows = await sql("SELECT * FROM radar_runs");
    expect(rows).toHaveLength(1);
    expect(rows[0].queries_sent).toBe(10);
    expect(JSON.stringify(rows[0].sources)).not.toContain("porte claquée");
  });

  it("refuse un statut inconnu ou un identifiant invalide", () => {
    expect(() => validateRun(run("abc", { status: "OK" }))).toThrow(ValidationError);
    expect(() => validateRun(run("'; DROP TABLE x; --"))).toThrow(ValidationError);
  });
});

describe("opportunités", () => {
  const opp = { source_id: "bluesky", key: "id:bluesky:at://x/1", detected_at: new Date().toISOString(), published_at: new Date(Date.now() - 42 * 60000).toISOString(), classe: "DEMANDE_CONFIRMEE", niveau_urgence: "ELEVEE", commune: "Pantin", departement: "93", url: "https://bsky.app/profile/exemple.test/post/1" };

  it("jamais de résultat Brave (validation + contrainte en base)", async () => {
    expect(() => validateOpportunity({ ...opp, source_id: "brave_search" })).toThrow(ValidationError);
    await expect(sql("INSERT INTO opportunities (source_id, key_hash, detected_at, classe) VALUES ('brave_search','h',now(),'X')")).rejects.toThrow();
  });

  it("déduplique par empreinte et gère le statut", async () => {
    await upsertOpportunity(sql, validateOpportunity(opp));
    await upsertOpportunity(sql, validateOpportunity(opp));
    const rows = await sql("SELECT id, key_hash, status FROM opportunities");
    expect(rows).toHaveLength(1);
    expect(rows[0].key_hash).toBe(keyHash(opp.key));
    expect(await updateOpportunityStatus(sql, Number(rows[0].id), "contactee")).toBe(true);
    await expect(updateOpportunityStatus(sql, Number(rows[0].id), "piratée")).rejects.toThrow(ValidationError);
  });

  it("refuse une URL non https", () => {
    expect(() => validateOpportunity({ ...opp, url: "javascript:alert(1)" })).toThrow(ValidationError);
  });
});

describe("interventions et tableau de bord", () => {
  it("valide la saisie", () => {
    expect(() => validateIntervention({ date_intervention: "2026-10-17", canal: "inconnu", statut: "realisee", montant_ttc: -5 })).toThrow(ValidationError);
    expect(() => validateIntervention({ date_intervention: "17/10", canal: "inconnu", statut: "realisee" })).toThrow(ValidationError);
    expect(() => validateIntervention({ date_intervention: "2026-10-17", canal: "pigeon", statut: "realisee" })).toThrow(ValidationError);
  });

  it("sépare observé et saisi, et calcule la marge par canal", async () => {
    await insertRun(sql, validateRun(run("r1", { status: "SUCCESS_WITH_LEADS", sources: { bluesky: { sent: 10, results: 3, relevant: 1, cost_usd: 0 } }, alerts: { generated: 1, accepted: 1 } })));
    await upsertOpportunity(sql, validateOpportunity({ source_id: "bluesky", key: "k1", detected_at: new Date().toISOString(), published_at: new Date(Date.now() - 30 * 60000).toISOString(), classe: "DEMANDE_CONFIRMEE", commune: "Pantin", departement: "93" }));
    const today = new Date().toISOString().slice(0, 10);
    await insertIntervention(sql, validateIntervention({ date_intervention: today, canal: "lead_radar", statut: "realisee", montant_ttc: 150, couts_directs: 20 }));
    await insertIntervention(sql, validateIntervention({ date_intervention: today, canal: "google_ads", statut: "annulee", appel_recu: true }));
    const d = await dashboard(sql);
    expect(d.observe.aujourdhui.pertinentes).toBe(1);
    expect(d.observe.aujourdhui.alertes_acceptees).toBe(1);
    expect(d.observe.parCommune[0]).toMatchObject({ zone: "Pantin", n: 1 });
    expect(d.observe.delaiPublicationDetectionMedianMin).toBe(30);
    const lr = d.saisi.parCanal30j.find((c) => c.canal === "lead_radar")!;
    expect(lr).toMatchObject({ realisees: 1, ca: 150, couts: 20, marge: 130 });
    const ads = d.saisi.parCanal30j.find((c) => c.canal === "google_ads")!;
    expect(ads).toMatchObject({ appels: 1, realisees: 0, ca: 0 });
  });
});
