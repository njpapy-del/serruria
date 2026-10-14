"use client";

import { Phone } from "lucide-react";
import { siteConfig } from "@/data/site-config";
import { pushEvent } from "@/lib/tracking";

type Props = {
  variant?: "solid" | "outline" | "text";
  /** "bar" : barre d'action mobile (deux boutons côte à côte, 48 px de haut). */
  size?: "sm" | "md" | "lg" | "bar";
  /** Par défaut : le numéro de téléphone du site. */
  label?: string;
  className?: string;
  location: string;
};

const sizeClasses: Record<NonNullable<Props["size"]>, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-3 text-base",
  lg: "px-7 py-4 text-lg",
  bar: "min-h-12 px-3 py-2 text-[15px]",
};

const variantClasses: Record<NonNullable<Props["variant"]>, string> = {
  solid:
    "bg-amber-500 text-navy-950 hover:bg-amber-400 shadow-lg shadow-amber-500/20",
  outline: "border-2 border-white text-white hover:bg-white/10",
  text: "text-navy-900 hover:text-amber-600",
};

export function PhoneCTA({
  variant = "solid",
  size = "md",
  label = siteConfig.contact.phoneDisplay,
  className = "",
  location,
}: Props) {
  return (
    <a
      href={siteConfig.contact.phoneHref}
      onClick={() => pushEvent("phone_click", { location })}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-bold tracking-wide transition-colors ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      aria-label={`Appeler ${siteConfig.brand.name} au ${siteConfig.contact.phoneDisplay}`}
    >
      <Phone className="h-5 w-5" aria-hidden="true" />
      {label}
    </a>
  );
}
