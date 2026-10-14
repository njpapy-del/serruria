"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { siteConfig } from "@/data/site-config";
import { Section, SectionHeading } from "@/components/ui/Section";
import { pushEvent } from "@/lib/tracking";
import { PhoneCTA } from "@/components/ui/PhoneCTA";
import { WhatsAppCTA } from "@/components/ui/WhatsAppCTA";
import { LIMITS, PROBLEME_OPTIONS, validateLead, type LeadErrors } from "@/lib/leadValidation";

type Status = "idle" | "submitting" | "success" | "error";

const INPUT_CLASS =
  "w-full rounded-xl border bg-white/5 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none";

function inputClass(hasError: boolean) {
  return `${INPUT_CLASS} ${hasError ? "border-red-400" : "border-white/15"}`;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-sm text-red-300">
      {message}
    </p>
  );
}

export function LeadForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<LeadErrors>({});
  const startedAtRef = useRef<number>(0);
  const hasStartedRef = useRef(false);
  // Garde de ré-entrance : vérifiée/activée de façon synchrone, avant tout
  // setState (asynchrone/batché) — bloque un second submit concurrent même
  // si le bouton n'a pas encore eu le temps de se désactiver visuellement.
  const isSubmittingRef = useRef(false);

  function handleFirstInteraction() {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    startedAtRef.current = Date.now();
    pushEvent("lead_form_start");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmittingRef.current) return;

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    const { errors: clientErrors } = validateLead(data);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) {
      const firstInvalid = form.querySelector<HTMLElement>(`[name="${Object.keys(clientErrors)[0]}"]`);
      firstInvalid?.focus();
      return;
    }

    isSubmittingRef.current = true;
    setStatus("submitting");

    // Seuls des codes techniques partent dans le dataLayer, jamais les
    // valeurs saisies (aucune donnée personnelle vers GA4 / Google Ads).
    let reason = "network";
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, startedAt: startedAtRef.current }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.ok) {
        reason = typeof json.error === "string" ? json.error : `http_${res.status}`;
        if (json.fields) setErrors(json.fields);
        throw new Error(reason);
      }

      setStatus("success");
      pushEvent("lead_form_submit");
      form.reset();
    } catch {
      setStatus("error");
      pushEvent("lead_form_error", { reason });
    } finally {
      isSubmittingRef.current = false;
    }
  }

  const submitting = status === "submitting";

  return (
    <Section id="lead-form" className="bg-navy-950 text-white">
      <div className="mx-auto max-w-xl">
        <SectionHeading
          title="Demander une intervention"
          description="Remplissez ce formulaire court : nous vous rappelons pour faire le point sur votre situation."
          tone="dark"
        />

        {/* Coordonnées directes : pour une urgence, l'appel reste le plus rapide. */}
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
          <p className="text-sm font-semibold text-slate-300">Urgence ? Contactez-nous directement :</p>
          <div className="mt-3 flex flex-col justify-center gap-3 sm:flex-row">
            <PhoneCTA location="lead_form_section" size="md" />
            <WhatsAppCTA location="lead_form_section" size="md" />
          </div>
          {siteConfig.contact.email ? (
            <p className="mt-3 text-sm text-slate-400">
              ou par e-mail :{" "}
              <a href={`mailto:${siteConfig.contact.email}`} className="text-slate-200 underline hover:text-amber-400">
                {siteConfig.contact.email}
              </a>
            </p>
          ) : null}
        </div>

        {status === "success" ? (
          <div role="status" className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-6 text-center">
            <p className="font-bold text-amber-300">Votre demande a bien été reçue.</p>
            <p className="mt-1 text-sm text-slate-300">
              Nous vous rappelons au numéro indiqué. Pour une urgence, vous pouvez aussi nous appeler
              au{" "}
              <a
                href={siteConfig.contact.phoneHref}
                onClick={() => pushEvent("phone_click", { location: "lead_form_success" })}
                className="font-bold text-white underline"
              >
                {siteConfig.contact.phoneDisplay}
              </a>
              .
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            onFocus={handleFirstInteraction}
            noValidate
            className="space-y-4"
            aria-busy={submitting}
          >
            {/* Champ honeypot anti-spam : invisible pour un humain, souvent rempli par les robots. */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="company">Ne pas remplir</label>
              <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            <div>
              <label htmlFor="nom" className="mb-1 block text-sm font-semibold text-slate-200">
                Nom
              </label>
              <input
                id="nom"
                name="nom"
                type="text"
                autoComplete="name"
                required
                maxLength={LIMITS.nom}
                aria-invalid={Boolean(errors.nom)}
                aria-describedby={errors.nom ? "nom-error" : undefined}
                className={inputClass(Boolean(errors.nom))}
              />
              <FieldError id="nom-error" message={errors.nom} />
            </div>

            <div>
              <label htmlFor="telephone" className="mb-1 block text-sm font-semibold text-slate-200">
                Téléphone
              </label>
              <input
                id="telephone"
                name="telephone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="06 12 34 56 78"
                required
                maxLength={LIMITS.telephone}
                aria-invalid={Boolean(errors.telephone)}
                aria-describedby={errors.telephone ? "telephone-error" : undefined}
                className={inputClass(Boolean(errors.telephone))}
              />
              <FieldError id="telephone-error" message={errors.telephone} />
            </div>

            <div>
              <label htmlFor="ville" className="mb-1 block text-sm font-semibold text-slate-200">
                Ville ou code postal
              </label>
              <input
                id="ville"
                name="ville"
                type="text"
                autoComplete="address-level2"
                required
                maxLength={LIMITS.ville}
                aria-invalid={Boolean(errors.ville)}
                aria-describedby={errors.ville ? "ville-error" : undefined}
                className={inputClass(Boolean(errors.ville))}
              />
              <FieldError id="ville-error" message={errors.ville} />
            </div>

            <div>
              <label htmlFor="probleme" className="mb-1 block text-sm font-semibold text-slate-200">
                Type de problème
              </label>
              <select
                id="probleme"
                name="probleme"
                required
                defaultValue=""
                aria-invalid={Boolean(errors.probleme)}
                aria-describedby={errors.probleme ? "probleme-error" : undefined}
                className={inputClass(Boolean(errors.probleme))}
              >
                <option value="" disabled>
                  Sélectionnez votre situation
                </option>
                {PROBLEME_OPTIONS.map((label) => (
                  <option key={label} value={label} className="text-navy-900">
                    {label}
                  </option>
                ))}
              </select>
              <FieldError id="probleme-error" message={errors.probleme} />
            </div>

            <div>
              <label htmlFor="message" className="mb-1 block text-sm font-semibold text-slate-200">
                Description (facultatif)
              </label>
              <textarea
                id="message"
                name="message"
                rows={3}
                maxLength={LIMITS.message}
                aria-invalid={Boolean(errors.message)}
                aria-describedby={errors.message ? "message-error" : undefined}
                className={inputClass(Boolean(errors.message))}
              />
              <FieldError id="message-error" message={errors.message} />
            </div>

            {status === "error" && (
              <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-200">
                Votre demande n&apos;a pas pu être envoyée. Vérifiez les champs ci-dessus ou appelez-nous
                directement au{" "}
                <a
                  href={siteConfig.contact.phoneHref}
                  onClick={() => pushEvent("phone_click", { location: "lead_form_error" })}
                  className="font-bold text-white underline"
                >
                  {siteConfig.contact.phoneDisplay}
                </a>
                .
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-4 text-lg font-bold text-navy-950 transition-colors hover:bg-amber-400 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  Envoi en cours…
                </>
              ) : (
                "Demander une intervention"
              )}
            </button>

            <p className="text-xs text-slate-400">
              Vos coordonnées servent uniquement à vous recontacter au sujet de cette demande. Voir notre{" "}
              <Link href="/politique-confidentialite" className="underline hover:text-amber-400">
                politique de confidentialité
              </Link>
              .
            </p>
          </form>
        )}
      </div>
    </Section>
  );
}
