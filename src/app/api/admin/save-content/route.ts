import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getFile, putFile } from "@/lib/githubContent";

const CONTENT_PATH = "src/data/content.json";
const ALLOWED_SECTIONS = [
  "contact",
  "legal",
  "brand",
  "hero",
  "promo",
  "trustBullets",
  "problemes",
  "tarifs",
  "etapes",
  "services",
  "confiance",
  "faq",
];

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { section?: string; value?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!body.section || !ALLOWED_SECTIONS.includes(body.section)) {
    return NextResponse.json({ error: "invalid_section" }, { status: 400 });
  }

  try {
    const file = await getFile(CONTENT_PATH);
    if (!file) return NextResponse.json({ error: "content_not_found" }, { status: 500 });

    const current = JSON.parse(file.content);
    current[body.section] = body.value;

    await putFile(
      CONTENT_PATH,
      JSON.stringify(current, null, 2) + "\n",
      `Admin: mise à jour de "${body.section}"`,
      file.sha
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/save-content]", error);
    return NextResponse.json({ error: "save_failed" }, { status: 502 });
  }
}
