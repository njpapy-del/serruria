// Initialisation de la base depuis l'administration (migrations versionnées, idempotentes).
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getSql } from "@/lib/db/sql";
import { migrateUp } from "@/lib/db/migrate";

export async function POST() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sql = getSql();
  if (!sql) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
  try {
    return NextResponse.json({ ok: true, applied: await migrateUp(sql) });
  } catch (error) {
    console.error("[admin/radar/migrate]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "migration_failed" }, { status: 502 });
  }
}
