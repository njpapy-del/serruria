import { NextResponse } from "next/server";
import { Resend } from "resend";
import { put } from "@vercel/blob";
import { siteConfig } from "@/data/site-config";

// Délai minimum entre l'affichage du formulaire et sa soumission : un envoi
// plus rapide que ça vient presque toujours d'un robot, pas d'un humain.
const MIN_FILL_TIME_MS = 1500;

type LeadPayload = {
  nom?: string;
  telephone?: string;
  ville?: string;
  probleme?: string;
  message?: string;
  company?: string; // honeypot
  startedAt?: number;
};

export async function POST(request: Request) {
  let body: LeadPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { nom, telephone, ville, probleme, message, company, startedAt } = body;

  // Honeypot rempli => robot, on répond succès sans rien envoyer (ne pas donner d'indice).
  if (company) {
    return NextResponse.json({ ok: true });
  }

  if (!nom || !telephone || !ville || !probleme) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  if (typeof startedAt === "number" && Date.now() - startedAt < MIN_FILL_TIME_MS) {
    return NextResponse.json({ error: "too_fast" }, { status: 400 });
  }

  const receivedAt = new Date().toISOString();
  const lead = { nom, telephone, ville, probleme, message: message || "", receivedAt };

  // 1) Sauvegarde persistante (Vercel Blob, privé) — priorité : ne jamais perdre
  // un lead même si l'email échoue ou n'est pas configuré. Récupérable ensuite
  // depuis /admin (onglet Leads).
  let savedToBlob = false;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
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
  const toEmail = process.env.LEAD_NOTIFICATION_EMAIL;

  if (apiKey && fromEmail && toEmail) {
    try {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: fromEmail,
        to: toEmail,
        subject: `Nouvelle demande de rappel — ${siteConfig.brand.name}`,
        text: [
          `Nom : ${nom}`,
          `Téléphone : ${telephone}`,
          `Ville : ${ville}`,
          `Problème : ${probleme}`,
          `Message : ${message || "—"}`,
        ].join("\n"),
      });
      emailSent = true;
    } catch (error) {
      console.error("[lead] Échec d'envoi Resend:", error);
    }
  }

  if (!savedToBlob && !emailSent) {
    // Ni la sauvegarde ni l'email n'ont fonctionné (ou ne sont pas configurés) :
    // on logge quand même pour ne jamais perdre silencieusement un lead.
    console.warn("[lead] Aucun stockage configuré — lead reçu uniquement dans les logs:", lead);
  }

  return NextResponse.json({ ok: true, savedToBlob, emailSent });
}
