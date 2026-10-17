// Client Search Console (API officielle « Search Analytics »), sans dépendance :
// authentification par compte de service (JWT RS256 signé avec node:crypto).
//
// Ce que l'API donne : les requêtes Google pour lesquelles CE site est apparu,
// ses pages, clics, impressions, CTR, position moyenne — avec 2 à 3 jours de
// retard, requêtes rares masquées par Google, 50 000 lignes max par jour.
// Ce qu'elle ne donne PAS : les recherches des internautes en général, leur
// identité, le temps réel, la position dans Google Maps.

import { createSign } from "node:crypto";

export type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };

export type SearchAnalyticsRow = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number };

export class SearchConsoleError extends Error {
  constructor(
    message: string,
    readonly code: "auth" | "permission" | "quota" | "http" | "config",
    readonly status?: number
  ) {
    super(message);
    this.name = "SearchConsoleError";
  }
}

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const TOKEN_URI = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/webmasters/v3/sites";

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/** Lit le compte de service depuis une variable d'environnement (JSON brut ou base64). */
export function parseServiceAccount(raw: string | undefined): ServiceAccount {
  if (!raw) throw new SearchConsoleError("GSC_SERVICE_ACCOUNT_JSON absente", "config");
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const sa = JSON.parse(text) as ServiceAccount;
  if (!sa.client_email || !sa.private_key) throw new SearchConsoleError("compte de service incomplet", "config");
  return sa;
}

export function signedJwt(sa: ServiceAccount, nowSec = Math.floor(Date.now() / 1000)): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: sa.token_uri ?? TOKEN_URI, iat: nowSec, exp: nowSec + 3600 })
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${b64url(signer.sign(sa.private_key))}`;
}

function fail(status: number, what: string): never {
  if (status === 401) throw new SearchConsoleError(`${what} : authentification refusée`, "auth", status);
  if (status === 403) throw new SearchConsoleError(`${what} : accès refusé (le compte de service n'est pas utilisateur de la propriété)`, "permission", status);
  if (status === 429) throw new SearchConsoleError(`${what} : quota atteint`, "quota", status);
  throw new SearchConsoleError(`${what} : HTTP ${status}`, "http", status);
}

export async function accessToken(sa: ServiceAccount, fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl(sa.token_uri ?? TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: signedJwt(sa) }),
  });
  if (!res.ok) fail(res.status, "jeton Google");
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new SearchConsoleError("jeton Google absent de la réponse", "auth");
  return json.access_token;
}

export async function searchAnalytics(
  token: string,
  property: string,
  body: { startDate: string; endDate: string; dimensions: string[]; rowLimit?: number; dimensionFilterGroups?: unknown[] },
  fetchImpl: typeof fetch = fetch
): Promise<SearchAnalyticsRow[]> {
  const res = await fetchImpl(`${API}/${encodeURIComponent(property)}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ rowLimit: 1000, ...body }),
  });
  if (!res.ok) fail(res.status, "Search Analytics");
  const json = (await res.json()) as { rows?: SearchAnalyticsRow[] };
  return json.rows ?? [];
}
