"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/#services", label: "Services" },
  { href: "/#confiance", label: "Pourquoi nous choisir ?" },
  { href: "/#tarifs", label: "Tarifs" },
  { href: "/#zones", label: "Zones d'intervention" },
  { href: "/#avis", label: "Avis" },
  { href: "/#faq", label: "FAQ" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-navy-900"
      >
        {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {open ? (
        <nav
          aria-label="Navigation principale"
          className="absolute left-0 right-0 top-full border-b border-slate-200 bg-white shadow-lg"
        >
          <ul className="container-srr flex flex-col divide-y divide-slate-100 py-2">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block py-4 text-lg font-semibold text-navy-800"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
