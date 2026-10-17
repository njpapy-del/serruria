// Limite des tentatives de connexion à l'administration.
// Mémoire de l'instance (Vercel peut lancer plusieurs instances : protection
// partielle) ; une fois la base Neon disponible, le comptage devient persistant
// (table admin_login_attempts, migration 002).
import { createHash } from "node:crypto";
import type { Sql } from "@/lib/db/sql";

export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60 * 1000;

const memory = new Map<string, number[]>();

export function ipKey(ip: string): string {
  // Empreinte : l'adresse IP n'est pas conservée en clair.
  return createHash("sha256").update(`login:${ip}`).digest("hex").slice(0, 32);
}

async function recentFailures(key: string, now: number, sql: Sql | null): Promise<number> {
  if (sql) {
    try {
      const rows = await sql("SELECT count(*)::int AS n FROM admin_login_attempts WHERE ip_hash = $1 AND at > now() - interval '15 minutes'", [key]);
      return Number(rows[0]?.n ?? 0);
    } catch {
      // table absente (migration 002 non appliquée) : repli mémoire
    }
  }
  const list = (memory.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  memory.set(key, list);
  return list.length;
}

export async function isBlocked(ip: string, sql: Sql | null, now = Date.now()): Promise<boolean> {
  return (await recentFailures(ipKey(ip), now, sql)) >= MAX_FAILURES;
}

export async function recordFailure(ip: string, sql: Sql | null, now = Date.now()): Promise<void> {
  const key = ipKey(ip);
  if (sql) {
    try {
      await sql("INSERT INTO admin_login_attempts (ip_hash) VALUES ($1)", [key]);
      return;
    } catch {
      // repli mémoire
    }
  }
  memory.set(key, [...(memory.get(key) ?? []).filter((t) => now - t < WINDOW_MS), now]);
}

/** Réservé aux tests. */
export function _resetMemory() {
  memory.clear();
}
