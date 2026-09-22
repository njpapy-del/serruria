import Link from "next/link";
import { Lock } from "lucide-react";
import { siteConfig } from "@/data/site-config";
import { PhoneCTA } from "@/components/ui/PhoneCTA";
import { MobileNav } from "@/components/layout/MobileNav";

const NAV_LINKS = [
  { href: "/#services", label: "Services" },
  { href: "/#confiance", label: "Pourquoi nous choisir ?" },
  { href: "/#tarifs", label: "Tarifs" },
  { href: "/#zones", label: "Zones d'intervention" },
  { href: "/#avis", label: "Avis" },
  { href: "/#faq", label: "FAQ" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur relative">
      <div className="container-srr flex h-16 items-center justify-between gap-3 lg:h-20">
        <Link
          href="/"
          className="min-w-0 flex-1 truncate text-sm font-extrabold leading-tight tracking-tight text-navy-900 sm:text-lg lg:flex-initial lg:text-2xl"
        >
          {siteConfig.brand.name}
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Navigation principale">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-base font-semibold text-navy-700 transition-colors hover:text-amber-600"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden flex-shrink-0 items-center gap-3 lg:flex">
          <Link
            href="/admin"
            aria-label="Espace admin"
            className="text-slate-300 transition-colors hover:text-navy-600"
          >
            <Lock className="h-5 w-5" />
          </Link>
          <PhoneCTA location="header" size="sm" />
        </div>

        <div className="flex flex-shrink-0 items-center gap-2 lg:hidden">
          <MobileNav />
          <PhoneCTA location="header_mobile" size="sm" label="APPELER" />
        </div>
      </div>
    </header>
  );
}
