// Pont entre l'agent Python (agent/) et le moteur TypeScript du radar.
// Lit sur l'entrée standard : { sourceId, mode, items: RawItem[] }
// Écrit sur la sortie standard : { results: [...] } — une qualification par item.
// Aucune donnée n'est stockée ici ; aucun journal ne contient le texte des items.

import { defaultRadarConfig } from "@/lib/radar/config";
import { dedupeKeys } from "@/lib/radar/dedupe";
import { qualify, type RawItem } from "@/lib/radar/qualify";
import { decideAction, DEFAULT_SOURCE_SETTINGS, generateResponse } from "@/lib/radar/respond";
import { getSource, type RadarMode } from "@/lib/radar/sources";

type Input = {
  sourceId: string;
  mode: RadarMode;
  now?: string;
  items: (Omit<RawItem, "publishedAt"> & { publishedAt: string | null })[];
};

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const input = JSON.parse(await readStdin()) as Input;
  const source = getSource(input.sourceId);
  if (!source) throw new Error(`Source inconnue : ${input.sourceId}`);
  if (!["surveillance", "assiste", "automatique"].includes(input.mode)) throw new Error("Mode invalide");

  const config = defaultRadarConfig();
  const now = input.now ? new Date(input.now) : new Date();
  const settings = { ...DEFAULT_SOURCE_SETTINGS, mode: input.mode };

  const results = input.items.map((raw) => {
    const item: RawItem = { ...raw, publishedAt: raw.publishedAt ? new Date(raw.publishedAt) : null };
    const q = qualify(item, source, config, now);
    const decision = decideAction(q, source, settings, process.env);
    const keys = dedupeKeys(item);
    const reponseProposee = decision.action === "aucune" ? null : generateResponse(q, config, keys[0] ?? item.title);
    return {
      dedupeKeys: keys,
      classe: q.classe,
      categorie: q.categorie,
      categorieRaison: q.categorieRaison,
      urgente: q.urgente,
      niveauUrgence: q.niveauUrgence,
      niveauUrgenceRaison: q.niveauUrgenceRaison,
      confiance: q.confiance,
      confianceRaison: q.confianceRaison,
      actionRecommandee: q.actionRecommandee,
      metier: q.metier,
      prestationProposee: q.prestationProposee,
      classeBrute: q.classeBrute,
      plomberie: q.plomberie.map((p) => ({ label: p.label, famille: p.famille })),
      score: q.score,
      lignes: q.lignes,
      services: q.services.map((s) => s.label),
      localisation:
        q.localisation.kind === "commune"
          ? { nom: q.localisation.commune.nom, departement: q.localisation.commune.departement }
          : q.localisation.kind === "departement"
            ? { nom: null, departement: q.localisation.departement }
            : null,
      decision,
      reponseProposee,
    };
  });

  process.stdout.write(JSON.stringify({ results }));
}

main().catch((error) => {
  process.stderr.write(`radar-cli: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
