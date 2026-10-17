import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getSql } from "@/lib/db/sql";
import { insertIntervention, validateIntervention, ValidationError } from "@/lib/db/radarRepo";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sql = getSql();
  if (!sql) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
  try {
    const id = await insertIntervention(sql, validateIntervention(await request.json().catch(() => ({}))));
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: "invalid", detail: error.message }, { status: 400 });
    return NextResponse.json({ error: "db_error" }, { status: 502 });
  }
}
