// Réception des passages du robot (métriques + opportunités conservables).
import { NextResponse } from "next/server";
import { getSql } from "@/lib/db/sql";
import { insertRun, upsertOpportunity, validateOpportunity, validateRun, ValidationError } from "@/lib/db/radarRepo";
import { isValidIngestToken } from "@/lib/radarAuth";
import { insertRunSources } from "@/lib/db/registryRepo";

const MAX_OPPORTUNITIES = 200;

export async function POST(request: Request) {
  if (!isValidIngestToken(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sql = getSql();
  if (!sql) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });

  let body: { run?: unknown; opportunities?: unknown[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  try {
    const run = validateRun(body.run);
    const opps = (Array.isArray(body.opportunities) ? body.opportunities : []).slice(0, MAX_OPPORTUNITIES).map(validateOpportunity);
    await insertRun(sql, run);
    // Journal par source : nos requêtes et des métriques (jamais de résultat Brave).
    await insertRunSources(sql, run.run_id, run.started_at_utc, run.sources as never);
    for (const o of opps) await upsertOpportunity(sql, o);
    return NextResponse.json({ ok: true, opportunities: opps.length });
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: "invalid", detail: error.message }, { status: 400 });
    console.error("[radar/ingest]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "db_error" }, { status: 502 });
  }
}
