"use client";

import { useEffect, useState } from "react";
import { pushConsentState } from "@/lib/tracking";
import { siteConfig } from "@/data/site-config";

const STORAGE_KEY = "srr_consent";

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!siteConfig.tracking.gtmId) return;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Stockage indisponible (navigation privée) : on affiche le bandeau à chaque visite.
    }
    if (stored === "granted") {
      pushConsentState(true);
    } else if (stored !== "denied") {
      setVisible(true);
    }
  }, []);

  if (!siteConfig.tracking.gtmId || !visible) return null;

  function choose(granted: boolean) {
    try {
      window.localStorage.setItem(STORAGE_KEY, granted ? "granted" : "denied");
    } catch {
      // Ignoré : le choix ne sera simplement pas mémorisé pour la prochaine visite.
    }
    pushConsentState(granted);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Consentement cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-4 shadow-[0_-8px_24px_-16px_rgba(5,8,16,0.35)] lg:bottom-4 lg:left-4 lg:right-auto lg:max-w-md lg:rounded-2xl lg:border"
    >
      <p className="text-sm text-navy-700">
        Nous utilisons des cookies de mesure d&apos;audience pour améliorer ce site. Vous pouvez
        les accepter ou les refuser.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => choose(true)}
          className="rounded-full bg-navy-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Accepter
        </button>
        <button
          type="button"
          onClick={() => choose(false)}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-navy-700"
        >
          Refuser
        </button>
      </div>
    </div>
  );
}
