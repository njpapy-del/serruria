"use client";

import Link from "next/link";
import { siteConfig } from "@/data/site-config";
import { pushEvent } from "@/lib/tracking";

export function Footer() {
  return (
    <footer className="bg-navy-950 pb-24 pt-16 text-slate-300 lg:pb-16">
      <div className="container-srr grid gap-10 lg:grid-cols-4">
        <div>
          <p className="text-xl font-extrabold text-white">{siteConfig.brand.name}</p>
          <p className="mt-3 max-w-xs text-sm text-slate-400">{siteConfig.brand.slogan}</p>
        </div>

        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-slate-400">Contact</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a
                href={siteConfig.contact.phoneHref}
                onClick={() => pushEvent("phone_click", { location: "footer" })}
                className="hover:text-amber-400"
              >
                {siteConfig.contact.phoneDisplay}
              </a>
            </li>
            {siteConfig.contact.email ? (
              <li>
                <a href={`mailto:${siteConfig.contact.email}`} className="hover:text-amber-400">
                  {siteConfig.contact.email}
                </a>
              </li>
            ) : null}
          </ul>
        </div>

        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-slate-400">Navigation</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/#services" className="hover:text-amber-400">
                Services
              </Link>
            </li>
            <li>
              <Link href="/#zones" className="hover:text-amber-400">
                Zones d&apos;intervention
              </Link>
            </li>
            <li>
              <Link href="/#faq" className="hover:text-amber-400">
                FAQ
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-slate-400">Informations légales</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/mentions-legales" className="hover:text-amber-400">
                Mentions légales
              </Link>
            </li>
            <li>
              <Link href="/politique-confidentialite" className="hover:text-amber-400">
                Politique de confidentialité
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="container-srr mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-slate-500">
        <span>
          © {new Date().getFullYear()} {siteConfig.brand.name}. Tous droits réservés.
        </span>
        <Link href="/admin" className="hover:text-amber-400">
          Se connecter
        </Link>
      </div>
    </footer>
  );
}
