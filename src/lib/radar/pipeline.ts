// Traitement d'un lot de contenus bruts : déduplication → qualification →
// réponse proposée → décision. Pur et sans stockage : la persistance (base
// PostgreSQL) et la planification seront branchées sur cette fonction.

import type { RadarConfig } from "./config";
import { dedupeKeys, type DedupeIndex } from "./dedupe";
import { qualify, type Qualification, type RawItem } from "./qualify";
import { decideAction, DEFAULT_SOURCE_SETTINGS, generateResponse, type Decision, type SourceSettings } from "./respond";
import type { SourceDescriptor } from "./sources";

export type Opportunity = {
  item: RawItem;
  dedupeKeys: string[];
  /** Clé déjà connue si doublon. */
  doublonDe: string | null;
  qualification: Qualification;
  /** Réponse proposée — jamais publiée par cette fonction. */
  reponseProposee: string | null;
  decision: Decision;
};

export type RunSummary = {
  sourceId: string;
  startedAt: Date;
  finishedAt: Date;
  lus: number;
  nouveaux: number;
  doublons: number;
  parCategorie: Record<string, number>;
};

export async function processItems(
  items: RawItem[],
  ctx: {
    source: SourceDescriptor;
    config: RadarConfig;
    index: DedupeIndex;
    now: Date;
    settings?: SourceSettings;
    env?: Record<string, string | undefined>;
  }
): Promise<{ opportunities: Opportunity[]; summary: RunSummary }> {
  const startedAt = new Date();
  const settings = ctx.settings ?? DEFAULT_SOURCE_SETTINGS;
  const opportunities: Opportunity[] = [];

  for (const item of items) {
    const keys = dedupeKeys(item);
    const doublonDe = await ctx.index.findExisting(keys);
    let qualification = qualify(item, ctx.source, ctx.config, ctx.now);

    if (doublonDe) {
      qualification = { ...qualification, categorie: "DOUBLON", categorieRaison: `déjà détecté (${doublonDe.split(":")[0]})` };
    } else {
      await ctx.index.remember(keys);
    }

    const decision = decideAction(qualification, ctx.source, settings, ctx.env ?? {});
    const reponseProposee =
      decision.action === "aucune" ? null : generateResponse(qualification, ctx.config, keys[0] ?? item.title);

    opportunities.push({ item, dedupeKeys: keys, doublonDe, qualification, reponseProposee, decision });
  }

  const parCategorie: Record<string, number> = {};
  for (const o of opportunities) parCategorie[o.qualification.categorie] = (parCategorie[o.qualification.categorie] ?? 0) + 1;
  const doublons = opportunities.filter((o) => o.doublonDe).length;

  return {
    opportunities,
    summary: {
      sourceId: ctx.source.id,
      startedAt,
      finishedAt: new Date(),
      lus: items.length,
      nouveaux: items.length - doublons,
      doublons,
      parCategorie,
    },
  };
}
