import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getSql } from "@/lib/db/sql";
import { updateOpportunityStatus, ValidationError } from "@/lib/db/radarRepo";
import { opportunityEvents } from "@/lib/db/registryRepo";

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sql = getSql();
  if (!sql) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "invalid" }, { status: 400 });
  return NextResponse.json({ events: await opportunityEvents(sql, id) });
}

export async function PATCH(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sql = getSql();
  if (!sql) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as { id?: unknown; status?: unknown };
  if (typeof body.id !== "number" || typeof body.status !== "string") return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    const ok = await updateOpportunityStatus(sql, body.id, body.status);
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_found" }, { status: 404 });
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: "invalid", detail: error.message }, { status: 400 });
    return NextResponse.json({ error: "db_error" }, { status: 502 });
  }
}
