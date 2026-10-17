// Accès PostgreSQL (Neon en production). Toutes les requêtes sont paramétrées.
import { neon } from "@neondatabase/serverless";

export type Row = Record<string, unknown>;
/** Exécuteur SQL minimal, implémenté par Neon (production) et PGlite (tests). */
export type Sql = (text: string, params?: unknown[]) => Promise<Row[]>;

let cached: Sql | null = null;

/** Exécuteur Neon si DATABASE_URL est définie, sinon null (« base non configurée »). */
export function getSql(): Sql | null {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const client = neon(url);
  cached = async (text, params = []) => (await client.query(text, params)) as Row[];
  return cached;
}
