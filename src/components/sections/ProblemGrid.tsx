import Image from "next/image";
import { siteConfig } from "@/data/site-config";
import { Section, SectionHeading } from "@/components/ui/Section";
import {
  DoorClosed,
  Lock,
  KeyRound,
  KeySquare,
  ShieldAlert,
  Wrench,
  ShieldOff,
  ShieldCheck,
} from "lucide-react";

const ICONS: Record<string, typeof DoorClosed> = {
  "porte-claquee": DoorClosed,
  "porte-verrouillee": Lock,
  "cle-cassee": KeyRound,
  "cle-perdue": KeySquare,
  "serrure-bloquee": ShieldAlert,
  "changement-serrure": Wrench,
  "apres-effraction": ShieldOff,
  "securisation-porte": ShieldCheck,
};

export function ProblemGrid() {
  return (
    <Section className="bg-slate-50">
      <SectionHeading title="Quel est votre problème ?" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {siteConfig.problemes.map((probleme) => {
          const Icon = ICONS[probleme.id] ?? Wrench;
          return (
            <a
              key={probleme.id}
              href="#lead-form"
              className="card-elevated group flex flex-col gap-3 overflow-hidden rounded-2xl bg-white p-3 text-center transition-transform hover:-translate-y-0.5"
            >
              {/* Cadre photo : affiche la vraie photo une fois fournie dans
                  site-config.ts, sinon une icône de secours (jamais de fausse photo). */}
              <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-navy-900/5">
                {probleme.photo ? (
                  <Image
                    src={probleme.photo}
                    alt={probleme.label}
                    fill
                    sizes="(min-width: 1024px) 22vw, 45vw"
                    className="object-cover"
                  />
                ) : (
                  <Icon className="h-8 w-8 text-navy-900" aria-hidden="true" />
                )}
              </span>
              <span className="text-sm font-semibold text-navy-800">{probleme.label}</span>
            </a>
          );
        })}
      </div>
    </Section>
  );
}
