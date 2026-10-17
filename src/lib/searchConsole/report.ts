// Rapport hebdomadaire Search Console : ce que Google montre réellement de CE site.
import { accessToken, searchAnalytics, type SearchAnalyticsRow, type ServiceAccount } from "./client";

export type GscReport = {
  property: string;
  periode: { debut: string; fin: string; note: string };
  totaux: { clics: number; impressions: number; ctr: number; positionMoyenne: number | null };
  requetes: { requete: string; clics: number; impressions: number; ctr: number; position: number }[];
  pages: { page: string; clics: number; impressions: number; position: number }[];
  opportunites: { requete: string; impressions: number; position: number; raison: string }[];
};

const LOCKSMITH = /serrur|porte|cl[eé]|verrou|cylindre|blind|d[eé]pann|ouvert/i;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 28 jours se terminant 3 jours avant aujourd'hui (délai de mise à disposition des données). */
export function reportWindow(now: Date): { startDate: string; endDate: string } {
  const end = new Date(now.getTime() - 3 * 86_400_000);
  const start = new Date(end.getTime() - 27 * 86_400_000);
  return { startDate: isoDay(start), endDate: isoDay(end) };
}

export function buildReport(property: string, window: { startDate: string; endDate: string }, byQuery: SearchAnalyticsRow[], byPage: SearchAnalyticsRow[]): GscReport {
  const clics = byQuery.reduce((s, r) => s + r.clicks, 0);
  const impressions = byQuery.reduce((s, r) => s + r.impressions, 0);
  const posPond = impressions ? byQuery.reduce((s, r) => s + r.position * r.impressions, 0) / impressions : null;
  const requetes = byQuery
    .map((r) => ({ requete: r.keys[0], clics: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }))
    .sort((a, b) => b.impressions - a.impressions);
  // Opportunités : requêtes de serrurerie déjà vues par Google mais mal classées ou peu cliquées.
  const opportunites = requetes
    .filter((r) => LOCKSMITH.test(r.requete) && r.impressions >= 10 && (r.position > 8 || r.ctr < 0.02))
    .slice(0, 20)
    .map((r) => ({
      requete: r.requete,
      impressions: r.impressions,
      position: Math.round(r.position * 10) / 10,
      raison: r.position > 8 ? "affiché au-delà de la 1re page" : "affiché mais très peu cliqué",
    }));
  return {
    property,
    periode: { debut: window.startDate, fin: window.endDate, note: "Données Search Console : 2 à 3 jours de retard ; requêtes rares masquées par Google." },
    totaux: { clics, impressions, ctr: impressions ? clics / impressions : 0, positionMoyenne: posPond === null ? null : Math.round(posPond * 10) / 10 },
    requetes: requetes.slice(0, 50),
    pages: byPage
      .map((r) => ({ page: r.keys[0], clics: r.clicks, impressions: r.impressions, position: Math.round(r.position * 10) / 10 }))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 30),
    opportunites,
  };
}

export async function fetchReport(sa: ServiceAccount, property: string, now: Date, fetchImpl: typeof fetch = fetch): Promise<GscReport> {
  const token = await accessToken(sa, fetchImpl);
  const window = reportWindow(now);
  const country = [{ filters: [{ dimension: "country", operator: "equals", expression: "fra" }] }];
  const byQuery = await searchAnalytics(token, property, { ...window, dimensions: ["query"], dimensionFilterGroups: country }, fetchImpl);
  const byPage = await searchAnalytics(token, property, { ...window, dimensions: ["page"], dimensionFilterGroups: country }, fetchImpl);
  return buildReport(property, window, byQuery, byPage);
}
