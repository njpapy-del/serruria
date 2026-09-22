import { NextResponse } from "next/server";
import { list, del } from "@vercel/blob";
import { isAdminAuthenticated } from "@/lib/adminAuth";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "blob_not_configured", leads: [] }, { status: 200 });
  }

  try {
    const { blobs } = await list({ prefix: "leads/" });
    const leads = await Promise.all(
      blobs.map(async (blob) => {
        const res = await fetch(blob.url, { cache: "no-store" });
        const data = await res.json();
        return { ...data, url: blob.url };
      })
    );
    leads.sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
    return NextResponse.json({ ok: true, leads });
  } catch (error) {
    console.error("[admin/leads] Échec de récupération:", error);
    return NextResponse.json({ error: "fetch_failed", leads: [] }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { url } = await request.json().catch(() => ({ url: null }));
  if (!url || typeof url !== "string" || !url.includes("leads/")) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  try {
    await del(url);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/leads] Échec de suppression:", error);
    return NextResponse.json({ error: "delete_failed" }, { status: 502 });
  }
}
