import { NextResponse } from "next/server";
import { checkPassword, createSessionToken, ADMIN_SESSION_COOKIE, SESSION_COOKIE_MAX_AGE } from "@/lib/adminAuth";
import { getSql } from "@/lib/db/sql";
import { isBlocked, recordFailure } from "@/lib/loginRateLimit";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "inconnue";
  const sql = getSql();
  if (await isBlocked(ip, sql)) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429, headers: { "Retry-After": "900" } });
  }
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (typeof body.password !== "string" || body.password.length > 200 || !checkPassword(body.password)) {
    await recordFailure(ip, sql);
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });
  return res;
}
