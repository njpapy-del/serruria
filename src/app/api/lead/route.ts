import { NextResponse } from "next/server";
import { Resend } from "resend";
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

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const toEmail = process.env.LEAD_NOTIFICATION_EMAIL;

  if (!apiKey || !fromEmail || !toEmail) {
    // Configuration email non fournie : on log côté serveur pour ne jamais perdre
    // silencieusement un lead pendant la mise en place initiale.
    console.warn("[lead] RESEND non configuré — lead reçu mais non transmis par email:", {
      nom,
      telephone,
      ville,
      probleme,
      message,
    });
    return NextResponse.json({ ok: true, emailSent: false });
  }

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
  } catch (error) {
    console.error("[lead] Échec d'envoi Resend:", error);
    return NextResponse.json({ error: "email_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, emailSent: true });
}
