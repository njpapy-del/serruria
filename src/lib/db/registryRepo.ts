// Registre des sources, journal par source, réglages et historiques.
import type { Row, Sql } from "./sql";
import { ValidationError } from "./radarRepo";

export type EtatEffectif = "ACTIVE" | "IDLE" | "ERROR" | "PAUSED" | "NOT_CONFIGURED" | "AUTHORIZATION_REQUIRED" | "ACCESS_NOT_PERMITTED";

/** Fenêtre au-delà de laquelle un ancien succès ne suffit plus à déclarer une source ACTIVE. */
export const ACTIVE_WINDOW_HOURS = 24;

/**
 * État réel d'une source.
 * - Interdite / sans autorisation / non configurée (registre) : jamais ACTIVE.
 * - Désactivée par l'administrateur : PAUSED.
 * - Dernière exécution en échec : ERROR ; robot signalant « non configurée » : NOT_CONFIGURED.
 * - ACTIVE seulement si un passage RÉUSSI a eu lieu dans les dernières 24 h ; sinon IDLE.
 */
export function etatEffectif(
  s: { etat_base: string; enabled: boolean; id?: string },
  last: { status: string; started_at: string | Date } | null,
  lastSuccessAt: string | Date | null,
  now = new Date()
): EtatEffectif {
  if (s.etat_base !== "ACTIVE") return s.etat_base as EtatEffectif;
  if (!s.enabled) return "PAUSED";
  if (s.id === "site_form") return "ACTIVE"; // canal interne, sans passage du robot
  if (last?.status === "SOURCE_NOT_CONFIGURED") return "NOT_CONFIGURED";
  if (last && (last.status === "SEARCH_FAILED" || last.status === "PARTIAL_SUCCESS")) return "ERROR";
  if (lastSuccessAt && now.getTime() - new Date(lastSuccessAt).getTime() <= ACTIVE_WINDOW_HOURS * 3_600_000) return "ACTIVE";
  return "IDLE";
}

export async function listSources(sql: Sql, now = new Date()) {
  const rows = await sql(`
    SELECT s.*,
      (SELECT row_to_json(r) FROM (SELECT status, started_at, error_kind, reason, duration_ms FROM run_sources rs
         WHERE rs.source_id = s.id AND rs.status <> 'SOURCE_NOT_RUN' ORDER BY started_at DESC LIMIT 1) r) AS dernier,
      (SELECT max(started_at) FROM run_sources rs WHERE rs.source_id = s.id) AS derniere_verification,
      (SELECT max(started_at) FROM run_sources rs WHERE rs.source_id = s.id
         AND rs.status IN ('SUCCESS_WITH_LEADS','SUCCESS_NO_RELEVANT_LEADS','SUCCESS_NO_RESULTS')) AS dernier_succes,
      (SELECT row_to_json(e) FROM (SELECT started_at, error_kind, reason FROM run_sources rs
         WHERE rs.source_id = s.id AND rs.status IN ('SEARCH_FAILED','PARTIAL_SUCCESS') ORDER BY started_at DESC LIMIT 1) e) AS derniere_erreur,
      coalesce((SELECT sum(attempted) FROM run_sources rs WHERE rs.source_id = s.id AND started_at > now() - interval '30 days'),0)::int AS requetes_30j,
      coalesce((SELECT sum(results) FROM run_sources rs WHERE rs.source_id = s.id AND started_at > now() - interval '30 days'),0)::int AS resultats_30j,
      coalesce((SELECT sum(qualified) FROM run_sources rs WHERE rs.source_id = s.id AND started_at > now() - interval '30 days'),0)::int AS pertinents_30j,
      coalesce((SELECT sum(cost_usd) FROM run_sources rs WHERE rs.source_id = s.id AND started_at > now() - interval '30 days'),0)::float AS cout_30j
    FROM sources s ORDER BY s.activable DESC, s.id`);
  return rows.map((r: Row): Row & { etat: EtatEffectif } => ({
    ...r,
    etat: etatEffectif(
      { etat_base: String(r.etat_base), enabled: Boolean(r.enabled), id: String(r.id) },
      (r.dernier as { status: string; started_at: string } | null) ?? null,
      (r.dernier_succes as string | null) ?? null,
      now
    ),
  }));
}

export async function setSourceEnabled(sql: Sql, id: string, enabled: boolean): Promise<void> {
  const [s] = await sql("SELECT id, etat_base, activable, enabled FROM sources WHERE id = $1", [id]);
  if (!s) throw new ValidationError("source inconnue");
  if (enabled && (!s.activable || s.etat_base === "ACCESS_NOT_PERMITTED" || s.etat_base === "AUTHORIZATION_REQUIRED")) {
    throw new ValidationError("source non activable (interdite, sans autorisation ou interne)");
  }
  if (Boolean(s.enabled) === enabled) return;
  await sql("UPDATE sources SET enabled = $2, updated_at = now() WHERE id = $1", [id, enabled]);
  await sql("INSERT INTO source_events (source_id, ancien, nouveau, motif, acteur) VALUES ($1,$2,$3,$4,'admin')", [
    id,
    s.enabled ? "ACTIVÉE" : "PAUSED",
    enabled ? "ACTIVÉE" : "PAUSED",
    enabled ? "réactivée par l'administrateur" : "mise en pause par l'administrateur",
  ]);
}

export async function sourceEvents(sql: Sql, limit = 50) {
  return sql("SELECT source_id, at, ancien, nouveau, motif, acteur FROM source_events ORDER BY at DESC LIMIT $1", [limit]);
}

// ── Journal par source ──────────────────────────────────────────────────────
type SrcMetrics = {
  status?: string;
  planned?: number;
  sent?: number;
  succeeded?: number;
  failed?: number;
  results?: number;
  relevant?: number;
  duplicates?: number;
  eliminated?: Record<string, number>;
  cost_usd?: number;
  queries?: unknown[];
  duration_ms?: number | null;
  error_kind?: string | null;
  reason?: string | null;
  lieux_couverts?: number;
};

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);

export async function insertRunSources(sql: Sql, runId: string, startedAt: string, sources: Record<string, SrcMetrics>): Promise<void> {
  for (const [sid, m] of Object.entries(sources ?? {})) {
    if (!/^[a-z_]{2,40}$/.test(sid)) continue;
    const queries = (Array.isArray(m.queries) ? m.queries : []).filter((q) => typeof q === "string").slice(0, 60).map((q) => (q as string).slice(0, 200));
    const rejected = Object.values(m.eliminated ?? {}).reduce((a, b) => a + n(b), 0);
    const cost = typeof m.cost_usd === "number" ? m.cost_usd : 0;
    await sql(
      `INSERT INTO run_sources (run_id, source_id, started_at, duration_ms, status, planned, attempted, succeeded, failed, results, rejected, qualified, duplicates, error_kind, reason, queries, lieux_couverts, cost_usd, cost_method)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) ON CONFLICT (run_id, source_id) DO NOTHING`,
      [
        runId,
        sid,
        startedAt,
        typeof m.duration_ms === "number" ? Math.round(m.duration_ms) : null,
        String(m.status ?? "SOURCE_NOT_RUN").slice(0, 40),
        n(m.planned),
        n(m.sent),
        n(m.succeeded),
        n(m.failed),
        n(m.results),
        rejected,
        n(m.relevant),
        n(m.duplicates),
        m.error_kind ? String(m.error_kind).slice(0, 40) : null,
        m.reason ? String(m.reason).slice(0, 200) : null,
        JSON.stringify(queries),
        n(m.lieux_couverts),
        cost,
        sid === "brave_search" ? "requêtes envoyées × 0,005 $ (tarif public Brave)" : cost > 0 ? "estimation du robot" : "gratuit",
      ]
    );
  }
}

export async function journal(sql: Sql, limit = 100) {
  return sql(
    `SELECT rs.*, r.alerts_accepted, r.alerts_failed, r.status AS run_status FROM run_sources rs JOIN radar_runs r USING (run_id)
      ORDER BY rs.started_at DESC, rs.source_id LIMIT $1`,
    [limit]
  );
}

// ── Réglages (validés côté serveur, relus et revalidés par le robot) ───────
const DEPTS = ["75", "77", "78", "91", "92", "93", "94", "95"];
const CLASSES = ["DEMANDE_CONFIRMEE", "DEMANDE_PROBABLE", "DEMANDE_DEVIS", "RECHERCHE_PRO"];

export type Settings = {
  bluesky_min_interval_minutes?: number;
  brave_max_queries_per_run?: number;
  brave_max_queries_per_day?: number;
  brave_rayon_prioritaire_km?: number;
  departements?: string[];
  notify_min_score?: number;
  notify_classes?: string[];
  alerts_enabled?: boolean;
  extra_keywords?: string[];
  expected_interval_minutes?: number;
};

function intIn(v: unknown, lo: number, hi: number, key: string): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < lo || v > hi) throw new ValidationError(`${key} : entier entre ${lo} et ${hi}`);
  return v;
}

export function validateSettings(x: unknown): Settings {
  const o = (x ?? {}) as Record<string, unknown>;
  const out: Settings = {};
  const allowed = new Set([
    "bluesky_min_interval_minutes",
    "brave_max_queries_per_run",
    "brave_max_queries_per_day",
    "brave_rayon_prioritaire_km",
    "departements",
    "notify_min_score",
    "notify_classes",
    "alerts_enabled",
    "extra_keywords",
    "expected_interval_minutes",
  ]);
  for (const k of Object.keys(o)) if (!allowed.has(k)) throw new ValidationError(`réglage inconnu : ${k}`);
  if ("bluesky_min_interval_minutes" in o) out.bluesky_min_interval_minutes = intIn(o.bluesky_min_interval_minutes, 10, 1440, "bluesky_min_interval_minutes");
  // Plafonds Brave : jamais au-delà de ce que garantit le crédit gratuit (6 × 4 créneaux).
  if ("brave_max_queries_per_run" in o) out.brave_max_queries_per_run = intIn(o.brave_max_queries_per_run, 0, 6, "brave_max_queries_per_run");
  if ("brave_max_queries_per_day" in o) out.brave_max_queries_per_day = intIn(o.brave_max_queries_per_day, 0, 24, "brave_max_queries_per_day");
  if ("brave_rayon_prioritaire_km" in o) out.brave_rayon_prioritaire_km = intIn(o.brave_rayon_prioritaire_km, 1, 50, "brave_rayon_prioritaire_km");
  if ("notify_min_score" in o) out.notify_min_score = intIn(o.notify_min_score, 0, 100, "notify_min_score");
  if ("expected_interval_minutes" in o) out.expected_interval_minutes = intIn(o.expected_interval_minutes, 5, 1440, "expected_interval_minutes");
  if ("departements" in o) {
    const d = o.departements;
    if (!Array.isArray(d) || d.length === 0 || !d.every((x) => DEPTS.includes(String(x)))) throw new ValidationError("departements : liste parmi 75, 77, 78, 91, 92, 93, 94, 95");
    out.departements = [...new Set(d.map(String))].sort();
  }
  if ("notify_classes" in o) {
    const c = o.notify_classes;
    if (!Array.isArray(c) || !c.every((x) => CLASSES.includes(String(x)))) throw new ValidationError("notify_classes invalide");
    out.notify_classes = c.map(String);
  }
  if ("alerts_enabled" in o) {
    if (typeof o.alerts_enabled !== "boolean") throw new ValidationError("alerts_enabled : vrai ou faux");
    out.alerts_enabled = o.alerts_enabled;
  }
  if ("extra_keywords" in o) {
    const k = o.extra_keywords;
    if (!Array.isArray(k) || k.length > 20 || !k.every((x) => typeof x === "string" && x.trim().length >= 2 && x.length <= 60)) {
      throw new ValidationError("extra_keywords : 20 expressions max, 2 à 60 caractères");
    }
    out.extra_keywords = k.map((x) => (x as string).trim());
  }
  return out;
}

export async function getSettings(sql: Sql): Promise<Settings & { sources_enabled: Record<string, boolean> }> {
  const rows = await sql("SELECT key, value FROM settings");
  const s = Object.fromEntries(rows.map((r: Row) => [String(r.key), r.value])) as Settings;
  const srcs = await sql("SELECT id, enabled FROM sources WHERE activable");
  return { ...s, sources_enabled: Object.fromEntries(srcs.map((r: Row) => [String(r.id), Boolean(r.enabled)])) };
}

export async function putSettings(sql: Sql, s: Settings): Promise<void> {
  for (const [k, v] of Object.entries(s)) {
    await sql("INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()", [k, JSON.stringify(v)]);
  }
}

// ── Historique des demandes ────────────────────────────────────────────────
export async function opportunityEvents(sql: Sql, opportunityId: number) {
  return sql("SELECT at, ancien, nouveau, acteur FROM opportunity_events WHERE opportunity_id = $1 ORDER BY at DESC", [opportunityId]);
}

// ── Vue d'ensemble et coûts ─────────────────────────────────────────────────
export async function overview(sql: Sql, now = new Date()) {
  const settings = await getSettings(sql);
  const interval = settings.expected_interval_minutes ?? 60;
  const [runs] = await sql(
    `SELECT count(*)::int AS executes,
            count(*) FILTER (WHERE status IN ('SUCCESS_WITH_LEADS','SUCCESS_NO_RELEVANT_LEADS','SUCCESS_NO_RESULTS'))::int AS reussis,
            max(started_at) AS dernier
       FROM radar_runs WHERE started_at > now() - interval '24 hours'`
  );
  const [last] = await sql("SELECT run_id, started_at, status FROM radar_runs ORDER BY started_at DESC LIMIT 1");
  const attendus = Math.floor((24 * 60) / interval);
  const lastAt = last ? new Date(String(last.started_at)) : null;
  const retardMin = lastAt ? Math.round((now.getTime() - lastAt.getTime()) / 60000) : null;
  const sources = await listSources(sql, now);
  const parEtat: Record<string, number> = {};
  for (const s of sources) parEtat[s.etat] = (parEtat[s.etat] ?? 0) + 1;
  return {
    intervalleAttenduMin: interval,
    dernierPassage: last ?? null,
    prochainPassagePrevu: lastAt ? new Date(lastAt.getTime() + interval * 60000).toISOString() : null,
    passages24h: { attendus, executes: Number(runs.executes), reussis: Number(runs.reussis) },
    tauxReussite: Number(runs.executes) > 0 ? Number(runs.reussis) / Number(runs.executes) : null,
    // Alerte si aucun passage depuis plus de 2 fois l'intervalle attendu.
    moteurArrete: retardMin === null || retardMin > 2 * interval,
    minutesDepuisDernier: retardMin,
    sourcesParEtat: parEtat,
  };
}

export async function costs(sql: Sql) {
  const parSource = await sql(
    `SELECT source_id, sum(attempted)::int AS requetes, sum(qualified)::int AS pertinentes, sum(cost_usd)::float AS cout
       FROM run_sources WHERE started_at > now() - interval '30 days' GROUP BY source_id ORDER BY cout DESC, source_id`
  );
  const [opp] = await sql(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE status <> 'nouvelle')::int AS examinees,
            count(*) FILTER (WHERE status = 'non_pertinente')::int AS faux_positifs,
            count(*) FILTER (WHERE status IN ('verifiee','a_contacter','contactee','gagnee'))::int AS confirmees
       FROM opportunities WHERE detected_at > now() - interval '30 days'`
  );
  const [iv] = await sql(
    `SELECT count(*) FILTER (WHERE statut = 'realisee')::int AS realisees, coalesce(sum(montant_ttc) FILTER (WHERE statut = 'realisee'),0)::float AS ca
       FROM interventions WHERE date_intervention >= current_date - 30`
  );
  return {
    parSource: parSource.map((r: Row): Row & { coutParPertinente: number | null } => ({
      ...r,
      // Calculable seulement s'il y a au moins une demande pertinente.
      coutParPertinente: Number(r.pertinentes) > 0 ? Number(r.cout) / Number(r.pertinentes) : null,
    })),
    tauxFauxPositifs: Number(opp.examinees) > 0 ? Number(opp.faux_positifs) / Number(opp.examinees) : null,
    demandesExaminees: Number(opp.examinees),
    demandesConfirmees: Number(opp.confirmees),
    interventionsRealisees: Number(iv.realisees),
    chiffreAffaires: Number(iv.ca),
  };
}
