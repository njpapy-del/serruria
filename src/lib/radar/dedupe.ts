// Déduplication des contenus détectés.
// Trois clés : identifiant fourni par la source, URL normalisée, empreinte du
// texte. L'index est une interface : en mémoire pour les tests, en base
// PostgreSQL une fois le socle déployé.

import type { RawItem } from "./qualify";
import { fingerprint, normalize } from "./text";

const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|mc_|ref$|ref_src$|igshid$|si$)/i;

/** Normalise une URL pour comparer deux liens vers la même page. */
export function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    // Lien de redirection Google (alertes) : on garde la vraie destination.
    if (/(^|\.)google\.[a-z.]+$/.test(url.hostname) && url.pathname === "/url") {
      const target = url.searchParams.get("url") ?? url.searchParams.get("q");
      if (target) return normalizeUrl(target);
    }
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    let s = `${url.protocol === "http:" ? "https:" : url.protocol}//${url.host}${url.pathname.replace(/\/+$/, "")}`;
    const query = url.searchParams.toString();
    if (query) s += `?${query}`;
    return s;
  } catch {
    return null;
  }
}

export function dedupeKeys(item: RawItem): string[] {
  const keys: string[] = [];
  if (item.externalId) keys.push(`id:${item.sourceId}:${item.externalId}`);
  const url = item.url ? normalizeUrl(item.url) : null;
  if (url) keys.push(`url:${url}`);
  // Même texte publié sur deux URL (republication, flux différents).
  const body = normalize(`${item.title} ${item.content}`).slice(0, 400);
  if (body.length >= 40) keys.push(`txt:${fingerprint(body)}`);
  return keys;
}

export interface DedupeIndex {
  /** Renvoie la clé déjà connue qui correspond, sinon null. */
  findExisting(keys: string[]): Promise<string | null>;
  remember(keys: string[]): Promise<void>;
}

export class MemoryDedupeIndex implements DedupeIndex {
  private seen = new Set<string>();
  async findExisting(keys: string[]) {
    return keys.find((k) => this.seen.has(k)) ?? null;
  }
  async remember(keys: string[]) {
    for (const k of keys) this.seen.add(k);
  }
}
