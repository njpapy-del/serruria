import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getSql } from "@/lib/db/sql";
import { dashboard } from "@/lib/db/radarRepo";

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sql = getSql();
  if (!sql) return NextResponse.json({ configured: false });
  try {
    return NextResponse.json({ configured: true, ...(await dashboard(sql)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Tables absentes : la base existe mais n'est pas initialisée.
    if (/relation .* does not exist/i.test(message)) return NextResponse.json({ configured: true, initialized: false });
    console.error("[admin/radar]", message);
    return NextResponse.json({ error: "db_error" }, { status: 502 });
  }
}
