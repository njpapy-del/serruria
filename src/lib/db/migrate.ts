// Migrations SQL versionnées (db/migrations/NNN_nom.up.sql / .down.sql).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Sql } from "./sql";

export const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

function versions(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".up.sql"))
    .map((f) => f.replace(/\.up\.sql$/, ""))
    .sort();
}

/**
 * Découpe un fichier SQL en instructions : coupe sur « ; » hors des chaînes
 * entre apostrophes (les '' doublés sont gérés) et ignore les commentaires « -- ».
 */
export function statements(sqlText: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inString = false;
  for (let i = 0; i < sqlText.length; i++) {
    const ch = sqlText[i];
    if (!inString && ch === "-" && sqlText[i + 1] === "-") {
      while (i < sqlText.length && sqlText[i] !== "\n") i++;
      cur += "\n";
      continue;
    }
    if (ch === "'") {
      if (inString && sqlText[i + 1] === "'") {
        cur += "''";
        i++;
        continue;
      }
      inString = !inString;
    }
    if (ch === ";" && !inString) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

async function applied(sql: Sql): Promise<Set<string>> {
  await sql("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
  const rows = await sql("SELECT version FROM schema_migrations");
  return new Set(rows.map((r) => String(r.version)));
}

export async function migrateUp(sql: Sql, dir = MIGRATIONS_DIR): Promise<string[]> {
  const done = await applied(sql);
  const ran: string[] = [];
  for (const v of versions(dir)) {
    if (done.has(v)) continue;
    for (const st of statements(readFileSync(path.join(dir, `${v}.up.sql`), "utf8"))) await sql(st);
    await sql("INSERT INTO schema_migrations (version) VALUES ($1)", [v]);
    ran.push(v);
  }
  return ran;
}

/** Annule la dernière migration appliquée. */
export async function migrateDown(sql: Sql, dir = MIGRATIONS_DIR): Promise<string | null> {
  const done = [...(await applied(sql))].sort();
  const last = done.at(-1);
  if (!last) return null;
  for (const st of statements(readFileSync(path.join(dir, `${last}.down.sql`), "utf8"))) await sql(st);
  await sql("DELETE FROM schema_migrations WHERE version = $1", [last]);
  return last;
}
