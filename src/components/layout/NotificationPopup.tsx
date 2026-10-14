"use client";

import { useEffect, useRef, useState } from "react";
import { X, Wrench } from "lucide-react";
import { PhoneCTA } from "@/components/ui/PhoneCTA";
import { QuoteCTA } from "@/components/ui/QuoteCTA";

// Plusieurs types d'entrée qui alternent à chaque apparition (fondu, rebond,
// "losange" rotatif, glissement) — la sortie reste toujours un fondu discret.
const ENTER_ANIMATIONS = ["popup-anim-fade", "popup-anim-bounce", "popup-anim-diamond", "popup-anim-slide"];

// Affichée une seule fois par session (pas de relance en boucle).
const FIRST_DELAY_MS = 20000;
const VISIBLE_MS = 12000;
const SEEN_KEY = "srr_popup_seen";

function alreadySeen(): boolean {
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    window.sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Stockage indisponible : la popup pourra réapparaître à la prochaine page.
  }
}

export function NotificationPopup() {
  const [phase, setPhase] = useState<"hidden" | "entering" | "leaving">("hidden");
  const [animIndex, setAnimIndex] = useState(0);
  const dismissedRef = useRef(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (alreadySeen()) return;

    timers.push(
      setTimeout(() => {
        if (dismissedRef.current) return;
        markSeen();
        setAnimIndex(Math.floor(Math.random() * ENTER_ANIMATIONS.length));
        setPhase("entering");
        timers.push(
          setTimeout(() => {
            setPhase("leaving");
            timers.push(setTimeout(() => setPhase("hidden"), 400));
          }, VISIBLE_MS)
        );
      }, FIRST_DELAY_MS)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  function dismiss() {
    dismissedRef.current = true;
    setPhase("leaving");
    setTimeout(() => setPhase("hidden"), 400);
  }

  if (phase === "hidden") return null;

  const animClass = phase === "leaving" ? "popup-anim-out" : ENTER_ANIMATIONS[animIndex];

  return (
    <div
      className={`fixed bottom-24 right-4 z-30 w-[calc(100%-2rem)] max-w-[300px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl lg:bottom-6 lg:right-6 ${animClass}`}
      role="dialog"
      aria-label="Besoin d'un serrurier"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fermer"
        className="absolute right-2 top-2 rounded-full p-1 text-slate-400 hover:text-navy-900"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-amber-600">
          <Wrench className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-bold text-navy-900">Besoin d&apos;un serrurier ?</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Appelez-nous ou décrivez votre situation en quelques secondes.
          </p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <PhoneCTA location="notification_popup" size="sm" className="flex-1 px-3" />
        <QuoteCTA
          location="notification_popup"
          label="Formulaire"
          className="flex-1 rounded-full border border-navy-900 px-3 py-2 text-center text-sm font-bold text-navy-900 hover:bg-navy-900/5"
        />
      </div>
    </div>
  );
}
