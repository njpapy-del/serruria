import Link from "next/link";
import { siteConfig } from "@/data/site-config";
import { PhoneCTA } from "@/components/ui/PhoneCTA";

const NAV_LINKS = [
  { href: "/#services", label: "Services" },
  { href: "/#tarifs", label: "Tarifs" },
  { href: "/#zones", label: "Zones d'intervention" },
  { href: "/#avis", label: "Avis" },
  { href: "/#faq", label: "FAQ" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container-srr flex h-16 items-center justify-between lg:h-20">
        <Link href="/" className="text-xl font-extrabold tracking-tight text-navy-900 lg:text-2xl">
          {siteConfig.brand.name}
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Navigation principale">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-navy-700 transition-colors hover:text-amber-600"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:block">
          <PhoneCTA location="header" size="sm" />
        </div>

        <div className="lg:hidden">
          <PhoneCTA location="header_mobile" size="sm" label="APPELER" />
        </div>
      </div>
    </header>
  );
}
