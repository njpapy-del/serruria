// Connecteur « Alertes web (flux RSS) ».
// Lit des flux RSS 2.0 ou Atom fournis par l'entreprise (Google Alerts,
// Talkwalker Alerts…). Lecture seule : ce connecteur ne publie jamais rien.

import type { RawItem } from "../qualify";
import { decodeEntities, stripHtml } from "../text";

export class ConnectorError extends Error {
  constructor(
    message: string,
    readonly code: "network" | "timeout" | "http" | "quota" | "parse",
    readonly retryable: boolean
  ) {
    super(message);
    this.name = "ConnectorError";
  }
}

const SOURCE_ID = "alertes_rss";
const MAX_BYTES = 2_000_000;

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1]).trim() : null;
}

function atomLink(block: string): string | null {
  const alternate = block.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
  const any = block.match(/<link\b[^>]*href=["']([^"']+)["']/i);
  const href = alternate?.[1] ?? any?.[1];
  return href ? decodeEntities(href) : null;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Analyse un flux RSS 2.0 ou Atom. Ne lève pas d'erreur sur une entrée isolée invalide. */
export function parseFeed(xml: string): RawItem[] {
  if (!/<(rss|feed|rdf:RDF)\b/i.test(xml)) {
    throw new ConnectorError("Le contenu reçu n'est pas un flux RSS ou Atom.", "parse", false);
  }
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((m) => m[0]);

  return blocks.map((block) => {
    const isAtom = /^<entry/i.test(block);
    const title = stripHtml(tag(block, "title") ?? "");
    const content = stripHtml(
      tag(block, "content") ?? tag(block, "description") ?? tag(block, "summary") ?? ""
    );
    const url = isAtom ? atomLink(block) : tag(block, "link") ?? atomLink(block);
    const externalId = tag(block, "guid") ?? tag(block, "id");
    const publishedAt = parseDate(tag(block, "pubDate") ?? tag(block, "published") ?? tag(block, "updated") ?? tag(block, "dc:date"));
    return { sourceId: SOURCE_ID, externalId, url, title, content, publishedAt };
  });
}

/** Télécharge et analyse un flux, avec délai maximal et erreurs typées. */
export async function fetchFeed(
  feedUrl: string,
  { fetchImpl = fetch, timeoutMs = 10_000 }: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): Promise<RawItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetchImpl(feedUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "SerrurerieLouisFils-LeadRadar/1.0 (+https://serrurerielouisfils.com)" },
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new ConnectorError(aborted ? "Délai dépassé." : "Erreur réseau.", aborted ? "timeout" : "network", true);
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) throw new ConnectorError("Quota de la source atteint (HTTP 429).", "quota", true);
  if (!res.ok) throw new ConnectorError(`Réponse HTTP ${res.status}.`, "http", res.status >= 500);

  const body = await res.text();
  if (body.length > MAX_BYTES) throw new ConnectorError("Flux trop volumineux.", "parse", false);
  return parseFeed(body);
}
