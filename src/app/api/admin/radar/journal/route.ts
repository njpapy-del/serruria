import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getSql } from "@/lib/db/sql";
import { journal } from "@/lib/db/registryRepo";

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sql = getSql();
  if (!sql) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
  try {
    return NextResponse.json({ journal: await journal(sql, 150) });
  } catch {
    return NextResponse.json({ error: "db_error" }, { status: 502 });
  }
}
