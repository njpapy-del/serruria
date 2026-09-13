"use client";

import { MessageCircle } from "lucide-react";
import { siteConfig } from "@/data/site-config";
import { pushEvent } from "@/lib/tracking";

type Props = {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
  location: string;
};

const sizeClasses: Record<NonNullable<Props["size"]>, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-3 text-base",
  lg: "px-7 py-4 text-lg",
};

export function WhatsAppCTA({ size = "md", label = "WHATSAPP", className = "", location }: Props) {
  const href = siteConfig.contact.whatsappHref;

  // Pas de numéro WhatsApp fourni : on n'affiche jamais un bouton vers un faux numéro.
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => pushEvent("whatsapp_click", { location })}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-success-500 font-bold tracking-wide text-white transition-colors hover:bg-success-500/90 ${sizeClasses[size]} ${className}`}
      aria-label={`Contacter ${siteConfig.brand.name} sur WhatsApp`}
    >
      <MessageCircle className="h-5 w-5" aria-hidden="true" />
      {label}
    </a>
  );
}
