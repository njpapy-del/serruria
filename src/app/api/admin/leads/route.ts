import { NextResponse } from "next/server";
import { list, del, get } from "@vercel/blob";
import { isAdminAuthenticated } from "@/lib/adminAuth";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID)) {
    return NextResponse.json({ error: "blob_not_configured", leads: [] }, { status: 200 });
  }

  try {
    const { blobs } = await list({ prefix: "leads/" });
    const leads = await Promise.all(
      blobs.map(async (blob) => {
        // Store privé : lecture authentifiée côté serveur ; store public : URL directe.
        if (process.env.LEADS_BLOB_ACCESS === "private") {
          const file = await get(blob.pathname, { access: "private", useCache: false });
          const text = file ? await new Response(file.stream).text() : "{}";
          return { ...JSON.parse(text), url: blob.url };
        }
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
