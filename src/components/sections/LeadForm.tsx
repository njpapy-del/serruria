"use client";

import { useRef, useState } from "react";
import { siteConfig } from "@/data/site-config";
import { Section, SectionHeading } from "@/components/ui/Section";
import { pushEvent } from "@/lib/tracking";

type Status = "idle" | "submitting" | "success" | "error";

export function LeadForm() {
  const [status, setStatus] = useState<Status>("idle");
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
    isSubmittingRef.current = true;
    setStatus("submitting");

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, startedAt: startedAtRef.current }),
      });

      if (!res.ok) throw new Error("submit_failed");

      setStatus("success");
      pushEvent("lead_form_submit");
      form.reset();
    } catch {
      setStatus("error");
    } finally {
      isSubmittingRef.current = false;
    }
  }

  return (
    <Section id="lead-form" className="bg-navy-950 text-white">
      <div className="mx-auto max-w-xl">
        <SectionHeading
          title="Demander un rappel"
          description="Un formulaire court : nous vous recontactons rapidement."
          tone="dark"
        />

        {status === "success" ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-6 text-center">
            <p className="font-bold text-amber-300">Votre demande a été envoyée.</p>
            <p className="mt-1 text-sm text-slate-300">
              Nous vous recontactons dès que possible. Pour une urgence, appelez-nous directement.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} onFocus={handleFirstInteraction} className="space-y-4">
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
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="telephone" className="mb-1 block text-sm font-semibold text-slate-200">
                Téléphone
              </label>
              <input
                id="telephone"
                name="telephone"
                type="tel"
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="ville" className="mb-1 block text-sm font-semibold text-slate-200">
                Ville
              </label>
              <input
                id="ville"
                name="ville"
                type="text"
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
              />
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
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-amber-400 focus:outline-none"
              >
                <option value="" disabled>
                  Sélectionnez votre situation
                </option>
                {siteConfig.problemes.map((probleme) => (
                  <option key={probleme.id} value={probleme.label} className="text-navy-900">
                    {probleme.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="message" className="mb-1 block text-sm font-semibold text-slate-200">
                Message (facultatif)
              </label>
              <textarea
                id="message"
                name="message"
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            {status === "error" && (
              <p className="text-sm text-red-400">
                Une erreur est survenue. Merci de réessayer ou de nous appeler directement.
              </p>
            )}

            <button
              type="submit"
              disabled={status === "submitting"}
              className="w-full rounded-full bg-amber-500 px-6 py-4 text-lg font-bold text-navy-950 transition-colors hover:bg-amber-400 disabled:opacity-60"
            >
              {status === "submitting" ? "Envoi en cours…" : "DEMANDER UN RAPPEL"}
            </button>
          </form>
        )}
      </div>
    </Section>
  );
}
