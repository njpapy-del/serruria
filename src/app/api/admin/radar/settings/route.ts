import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getSql } from "@/lib/db/sql";
import { ValidationError } from "@/lib/db/radarRepo";
import { getSettings, putSettings, validateSettings } from "@/lib/db/registryRepo";

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sql = getSql();
  if (!sql) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
  try {
    return NextResponse.json({ settings: await getSettings(sql) });
  } catch {
    return NextResponse.json({ error: "db_error" }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sql = getSql();
  if (!sql) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
  try {
    await putSettings(sql, validateSettings(await request.json().catch(() => null)));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: "invalid", detail: error.message }, { status: 400 });
    return NextResponse.json({ error: "db_error" }, { status: 502 });
  }
}
