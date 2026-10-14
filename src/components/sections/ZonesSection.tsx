import Link from "next/link";
import { MapPin } from "lucide-react";
import { siteConfig } from "@/data/site-config";
import { departements } from "@/data/departements";
import { Section, SectionHeading } from "@/components/ui/Section";
import { ZonesMapClient } from "@/components/sections/ZonesMapClient";

export function ZonesSection() {
  return (
    <Section id="zones">
      <SectionHeading
        title="Zone d'intervention en Île-de-France"
        description={`${siteConfig.brand.name} intervient à Paris et dans les départements d'Île-de-France ci-dessous. Indiquez votre ville au moment de votre demande.`}
      />

      <div className="grid gap-6 overflow-hidden rounded-2xl border border-slate-200 bg-white card-elevated lg:grid-cols-[1.4fr_1fr]">
        <div className="h-[320px] lg:h-[460px]">
          <ZonesMapClient />
        </div>

        <ul className="grid content-center gap-2 p-5 sm:grid-cols-2 lg:grid-cols-1 lg:p-8">
          {departements.map((d) => (
            <li key={d.code}>
              <Link
                href={d.slug ? `/serrurier/${d.slug}` : "#zones"}
                className="flex items-center gap-3 rounded-xl px-3 py-2 font-semibold text-navy-900 transition-colors hover:bg-slate-50"
              >
                <span
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-navy-950"
                  style={{ backgroundColor: d.color }}
                >
                  {d.code}
                </span>
                {d.nom}
                <MapPin className="ml-auto h-4 w-4 text-slate-300" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
