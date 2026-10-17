// Réglages lus par le robot au début de chaque passage (jeton Bearer du robot).
import { NextResponse } from "next/server";
import { getSql } from "@/lib/db/sql";
import { getSettings } from "@/lib/db/registryRepo";
import { isValidIngestToken } from "@/lib/radarAuth";

export async function GET(request: Request) {
  if (!isValidIngestToken(request.headers.get("authorization"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sql = getSql();
  if (!sql) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
  try {
    return NextResponse.json({ settings: await getSettings(sql) });
  } catch {
    return NextResponse.json({ error: "db_error" }, { status: 502 });
  }
}
