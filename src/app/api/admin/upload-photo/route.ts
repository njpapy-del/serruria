import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getFile, putFile, putBinaryFile } from "@/lib/githubContent";

const CONTENT_PATH = "src/data/content.json";
const ALLOWED_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const MAX_BYTES = 5 * 1024 * 1024; // 5 Mo

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { problemeId?: string; slotIndex?: number; dataUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { problemeId, slotIndex, dataUrl } = body;
  if (!problemeId || slotIndex == null || !dataUrl) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const match = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl);
  if (!match || !ALLOWED_MIME[match[1]]) {
    return NextResponse.json({ error: "unsupported_type" }, { status: 400 });
  }
  const [, mime, base64] = match;
  const ext = ALLOWED_MIME[mime];

  const approxBytes = (base64.length * 3) / 4;
  if (approxBytes > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }

  const filename = `${problemeId}-${Date.now()}.${ext}`;
  const filePath = `public/images/problemes/${filename}`;
  const publicPath = `/images/problemes/${filename}`;

  try {
    await putBinaryFile(filePath, base64, `Admin: nouvelle photo pour "${problemeId}"`);

    const file = await getFile(CONTENT_PATH);
    if (!file) return NextResponse.json({ error: "content_not_found" }, { status: 500 });

    const current = JSON.parse(file.content);
    const probleme = current.problemes.find((p: { id: string }) => p.id === problemeId);
    if (!probleme) return NextResponse.json({ error: "unknown_probleme" }, { status: 400 });

    probleme.photos[slotIndex] = publicPath;

    await putFile(
      CONTENT_PATH,
      JSON.stringify(current, null, 2) + "\n",
      `Admin: photo mise à jour pour "${problemeId}"`,
      file.sha
    );

    return NextResponse.json({ ok: true, path: publicPath });
  } catch (error) {
    console.error("[admin/upload-photo]", error);
    return NextResponse.json({ error: "upload_failed" }, { status: 502 });
  }
}
