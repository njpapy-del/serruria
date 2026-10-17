// Données du Lead Radar : passages, opportunités, interventions.
// Règles : aucun résultat Brave stocké ; aucune donnée personnelle de prospect.
import { createHash } from "node:crypto";
import type { Row, Sql } from "./sql";

const RUN_STATUSES = [
  "SUCCESS_WITH_LEADS",
  "SUCCESS_NO_RELEVANT_LEADS",
  "SUCCESS_NO_RESULTS",
  "PARTIAL_SUCCESS",
  "SEARCH_FAILED",
  "SOURCE_NOT_CONFIGURED",
  "SOURCE_NOT_RUN",
  "EMAIL_FAILED",
] as const;
const PERSISTABLE_SOURCES = ["bluesky", "alertes_rss", "site_form"] as const;
export const CANAUX = [
  "google_ads",
  "fiche_google",
  "referencement_naturel",
  "lead_radar",
  "formulaire_site",
  "whatsapp",
  "bouche_a_oreille",
  "autre",
  "inconnu",
] as const;
export const OPPORTUNITY_STATUSES = ["nouvelle", "verifiee", "a_contacter", "contactee", "gagnee", "perdue", "non_pertinente"] as const;

export class ValidationError extends Error {}

const str = (v: unknown, max = 200): string | null => (typeof v === "string" && v.length > 0 ? v.slice(0, max) : null);
const int = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);
const date = (v: unknown): string | null => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);

export function keyHash(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 40);
}

export type IngestRun = {
  run_id: string;
  mode: string;
  started_at_utc: string;
  finished_at_utc?: string | null;
  status: string;
  sources: Record<string, { sent?: number; results?: number; relevant?: number; cost_usd?: number; status?: string }>;
  alerts?: { accepted?: number; generated?: number };
};

export type IngestOpportunity = {
  source_id: string;
  key: string;
  detected_at: string;
  published_at?: string | null;
  classe: string;
  niveau_urgence?: string | null;
  confiance?: string | null;
  score?: number | null;
  service?: string | null;
  commune?: string | null;
  departement?: string | null;
  url?: string | null;
  /** Motifs du classement (critères et mots détectés), jamais le texte publié. */
  motifs?: string[];
};

export function validateRun(r: unknown): IngestRun {
  const o = (r ?? {}) as Record<string, unknown>;
  const run_id = str(o.run_id, 40);
  if (!run_id || !/^[a-z0-9-]+$/i.test(run_id)) throw new ValidationError("run_id invalide");
  if (!RUN_STATUSES.includes(o.status as (typeof RUN_STATUSES)[number])) throw new ValidationError("statut invalide");
  if (!date(o.started_at_utc)) throw new ValidationError("started_at_utc invalide");
  if (typeof o.sources !== "object" || o.sources === null) throw new ValidationError("sources invalides");
  return o as unknown as IngestRun;
}

export function validateOpportunity(x: unknown): IngestOpportunity {
  const o = (x ?? {}) as Record<string, unknown>;
  if (!PERSISTABLE_SOURCES.includes(o.source_id as (typeof PERSISTABLE_SOURCES)[number])) {
    throw new ValidationError("source non conservable (les résultats Brave ne sont jamais stockés)");
  }
  if (!str(o.key, 500) || !date(o.detected_at) || !str(o.classe, 40)) throw new ValidationError("opportunité incomplète");
  const url = str(o.url, 500);
  if (url && !/^https:\/\//.test(url)) throw new ValidationError("URL invalide");
  if (o.motifs !== undefined && (!Array.isArray(o.motifs) || o.motifs.length > 12 || !o.motifs.every((m) => typeof m === "string" && m.length <= 200))) {
    throw new ValidationError("motifs invalides");
  }
  return o as unknown as IngestOpportunity;
}

export async function insertRun(sql: Sql, r: IngestRun): Promise<void> {
  const srcs = Object.values(r.sources ?? {});
  const sum = (k: "sent" | "results" | "relevant") => srcs.reduce((s, x) => s + int(x[k]), 0);
  const cost = srcs.reduce((s, x) => s + (typeof x.cost_usd === "number" ? x.cost_usd : 0), 0);
  // Seules les métriques par source sont conservées (ni requêtes, ni URL).
  const slim = Object.fromEntries(
    Object.entries(r.sources ?? {}).map(([k, v]) => [k, { status: v.status ?? null, sent: int(v.sent), results: int(v.results), relevant: int(v.relevant), cost_usd: v.cost_usd ?? 0 }])
  );
  const accepted = int(r.alerts?.accepted);
  const failed = Math.max(0, int(r.alerts?.generated) - accepted);
  await sql(
    `INSERT INTO radar_runs (run_id, mode, started_at, finished_at, status, queries_sent, results, relevant, alerts_accepted, alerts_failed, cost_usd, sources)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (run_id) DO NOTHING`,
    [r.run_id, str(r.mode, 20) ?? "inconnu", date(r.started_at_utc), date(r.finished_at_utc), r.status, sum("sent"), sum("results"), sum("relevant"), accepted, failed, cost, JSON.stringify(slim)]
  );
}

export async function upsertOpportunity(sql: Sql, o: IngestOpportunity): Promise<void> {
  await sql(
    `INSERT INTO opportunities (source_id, key_hash, detected_at, published_at, classe, niveau_urgence, confiance, score, service, commune, departement, url, motifs)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (key_hash) DO NOTHING`,
    [
      o.source_id,
      keyHash(o.key),
      date(o.detected_at),
      date(o.published_at),
      str(o.classe, 40),
      str(o.niveau_urgence, 20),
      str(o.confiance, 10),
      typeof o.score === "number" ? Math.round(o.score) : null,
      str(o.service, 80),
      str(o.commune, 80),
      str(o.departement, 3),
      str(o.url, 500),
      JSON.stringify(o.motifs ?? []),
    ]
  );
}

export async function updateOpportunityStatus(sql: Sql, id: number, status: string): Promise<boolean> {
  if (!OPPORTUNITY_STATUSES.includes(status as (typeof OPPORTUNITY_STATUSES)[number])) throw new ValidationError("statut invalide");
  const [before] = await sql("SELECT status FROM opportunities WHERE id = $1", [id]);
  if (!before) return false;
  await sql("UPDATE opportunities SET status = $2, updated_at = now() WHERE id = $1", [id, status]);
  await sql("INSERT INTO opportunity_events (opportunity_id, ancien, nouveau, acteur) VALUES ($1,$2,$3,'admin')", [id, before.status, status]);
  return true;
}

export type InterventionInput = {
  date_intervention: string;
  canal: string;
  statut: string;
  appel_recu?: boolean;
  montant_ttc?: number | null;
  couts_directs?: number | null;
  opportunity_id?: number | null;
  note?: string | null;
};

export function validateIntervention(x: unknown): InterventionInput {
  const o = (x ?? {}) as Record<string, unknown>;
  if (typeof o.date_intervention !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o.date_intervention)) throw new ValidationError("date invalide");
  if (!CANAUX.includes(o.canal as (typeof CANAUX)[number])) throw new ValidationError("canal invalide");
  if (!["planifiee", "realisee", "annulee"].includes(String(o.statut))) throw new ValidationError("statut invalide");
  for (const k of ["montant_ttc", "couts_directs"] as const) {
    const v = o[k];
    if (v !== undefined && v !== null && (typeof v !== "number" || v < 0 || v > 100_000)) throw new ValidationError(`${k} invalide`);
  }
  if (o.note !== undefined && o.note !== null && (typeof o.note !== "string" || o.note.length > 500)) throw new ValidationError("note trop longue");
  return o as unknown as InterventionInput;
}

export async function insertIntervention(sql: Sql, i: InterventionInput): Promise<number> {
  const rows = await sql(
    `INSERT INTO interventions (date_intervention, canal, statut, appel_recu, montant_ttc, couts_directs, opportunity_id, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [i.date_intervention, i.canal, i.statut, i.appel_recu ?? true, i.montant_ttc ?? null, i.couts_directs ?? null, i.opportunity_id ?? null, i.note ?? null]
  );
  return Number(rows[0].id);
}

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

/** Données du tableau de bord. « observé » = mesuré par le robot ; « saisi » = entré à la main. */
export async function dashboard(sql: Sql) {
  const [today] = await sql(
    `SELECT count(*)::int AS passages, coalesce(sum(queries_sent),0)::int AS recherches, coalesce(sum(results),0)::int AS resultats,
            coalesce(sum(relevant),0)::int AS pertinentes, coalesce(sum(alerts_accepted),0)::int AS alertes_acceptees,
            coalesce(sum(alerts_failed),0)::int AS alertes_echouees, coalesce(sum(cost_usd),0)::float AS cout_usd,
            max(started_at) AS dernier_passage
       FROM radar_runs WHERE started_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris'`
  );
  const [last] = await sql("SELECT run_id, started_at, status FROM radar_runs ORDER BY started_at DESC LIMIT 1");
  const runs = await sql("SELECT run_id, started_at, finished_at, status, queries_sent, results, relevant, alerts_accepted, cost_usd FROM radar_runs ORDER BY started_at DESC LIMIT 30");
  const statuses = await sql(`SELECT status, count(*)::int AS n FROM radar_runs WHERE started_at >= now() - interval '7 days' GROUP BY status ORDER BY n DESC`);
  const opportunities = await sql(
    "SELECT id, source_id, detected_at, published_at, classe, niveau_urgence, confiance, score, service, commune, departement, url, status, motifs FROM opportunities ORDER BY detected_at DESC LIMIT 200"
  );
  const parCommune = await sql(
    `SELECT coalesce(commune, 'Département ' || departement, 'Inconnue') AS zone, count(*)::int AS n FROM opportunities
      WHERE detected_at >= now() - interval '30 days' GROUP BY 1 ORDER BY n DESC LIMIT 15`
  );
  const parSource = await sql(`SELECT source_id, count(*)::int AS n FROM opportunities WHERE detected_at >= now() - interval '30 days' GROUP BY 1 ORDER BY n DESC`);
  const [delai] = await sql(
    `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM detected_at - published_at) / 60)::float AS median_min
       FROM opportunities WHERE published_at IS NOT NULL AND detected_at >= now() - interval '30 days'`
  );
  const interventions = await sql(
    "SELECT id, date_intervention, canal, statut, appel_recu, montant_ttc, couts_directs, opportunity_id, note FROM interventions ORDER BY date_intervention DESC, id DESC LIMIT 100"
  );
  const parCanal = await sql(
    `SELECT canal, count(*) FILTER (WHERE appel_recu)::int AS appels, count(*) FILTER (WHERE statut = 'realisee')::int AS realisees,
            coalesce(sum(montant_ttc) FILTER (WHERE statut = 'realisee'),0)::float AS ca, coalesce(sum(couts_directs) FILTER (WHERE statut = 'realisee'),0)::float AS couts
       FROM interventions WHERE date_intervention >= current_date - 30 GROUP BY canal ORDER BY ca DESC`
  );
  return {
    observe: {
      aujourdhui: { ...today, cout_usd: num(today.cout_usd) } as Row,
      dernierPassage: last ?? null,
      statuts7j: statuses,
      passages: runs,
      opportunites: opportunities,
      parCommune,
      parSource,
      delaiPublicationDetectionMedianMin: delai?.median_min === null || delai?.median_min === undefined ? null : Math.round(Number(delai.median_min)),
    },
    saisi: {
      interventions,
      parCanal30j: parCanal.map((r: Row): Row => ({ ...r, marge: num(r.ca) - num(r.couts) })),
    },
  };
}
