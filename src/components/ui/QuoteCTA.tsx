"use client";

import { pushEvent } from "@/lib/tracking";

type Props = {
  label?: string;
  className?: string;
  location: string;
};

export function QuoteCTA({ label = "DEMANDER UN DEVIS GRATUIT", className = "", location }: Props) {
  return (
    <a
      href="#lead-form"
      onClick={() => pushEvent("quote_request", { location })}
      className={
        className ||
        "inline-flex items-center justify-center rounded-full border-2 border-white/80 px-7 py-4 text-lg font-bold text-white transition-colors hover:bg-white/10"
      }
    >
      {label}
    </a>
  );
}
