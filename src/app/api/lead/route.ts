import { NextResponse } from "next/server";
import { Resend } from "resend";
import { put } from "@vercel/blob";
import { siteConfig } from "@/data/site-config";
import { validateLead } from "@/lib/leadValidation";

// Délai minimum entre l'affichage du formulaire et sa soumission : un envoi
// plus rapide que ça vient presque toujours d'un robot, pas d'un humain.
const MIN_FILL_TIME_MS = 1500;

// Limite anti-abus par IP. Mémoire de l'instance serverless uniquement :
// freine un envoi en rafale, sans prétendre être une protection absolue.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const recentByIp = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (recentByIp.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  recentByIp.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { company, startedAt } = body;

  // Honeypot rempli => robot, on répond succès sans rien envoyer (ne pas donner d'indice).
  if (company) {
    return NextResponse.json({ ok: true });
  }

  const { fields, errors } = validateLead(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "invalid_fields", fields: errors }, { status: 400 });
  }

  if (typeof startedAt === "number" && Date.now() - startedAt < MIN_FILL_TIME_MS) {
    return NextResponse.json({ error: "too_fast" }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { nom, telephone, ville, probleme, message } = fields;
  const receivedAt = new Date().toISOString();
  const lead = { nom, telephone, ville, probleme, message, receivedAt };

  // 1) Sauvegarde persistante (Vercel Blob, privé) — priorité : ne jamais perdre
  // un lead même si l'email échoue ou n'est pas configuré. Récupérable ensuite
  // depuis /admin (onglet Leads).
  let savedToBlob = false;
  // Store relié par token classique ou par OIDC (BLOB_STORE_ID).
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) {
    try {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      // "public" est le seul mode d'accès de Vercel Blob (pas d'auth sur l'URL
      // elle-même) — la confidentialité vient du suffixe aléatoire et du fait
      // que cette URL n'est jamais exposée publiquement sur le site : seule
      // la route admin (protégée par mot de passe) liste/lit ces fichiers,
      // via le token serveur, jamais par lien direct.
      await put(`leads/${id}.json`, JSON.stringify(lead), {
        access: "public",
        addRandomSuffix: true,
        contentType: "application/json",
      });
      savedToBlob = true;
    } catch (error) {
      console.error("[lead] Échec de sauvegarde Vercel Blob:", error);
    }
  }

  // 2) Notification email (best-effort, ne bloque jamais la réussite si le
  // lead est déjà sauvegardé ci-dessus).
  let emailSent = false;
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  // Une ou plusieurs adresses séparées par des virgules.
  const toEmails = (process.env.LEAD_NOTIFICATION_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (apiKey && fromEmail && toEmails.length > 0) {
    try {
      const resend = new Resend(apiKey);
      // Le SDK Resend ne lève pas d'exception sur un refus de l'API (clé
      // invalide, domaine non vérifié…) : il renvoie `error`.
      const { error } = await resend.emails.send({
        from: fromEmail,
        to: toEmails,
        subject: `Demande d'intervention — ${probleme} — ${ville}`,
        text: [
          `Nom : ${nom}`,
          `Téléphone : ${telephone}`,
          `Ville : ${ville}`,
          `Problème : ${probleme}`,
          `Description : ${message || "—"}`,
          "",
          `Reçue le ${new Date(receivedAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} via ${siteConfig.siteUrl}`,
        ].join("\n"),
      });
      if (error) throw error;
      emailSent = true;
    } catch (error) {
      console.error("[lead] Échec d'envoi Resend:", error);
    }
  }

  if (!savedToBlob && !emailSent) {
    // Ni la sauvegarde ni l'email n'ont fonctionné : la demande n'est pas
    // réellement reçue, on ne confirme donc pas au visiteur (il est invité à
    // appeler). Trace dans les logs pour pouvoir la récupérer malgré tout.
    console.error("[lead] Demande non enregistrée ni envoyée:", lead);
    return NextResponse.json({ error: "delivery_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, savedToBlob, emailSent });
}
