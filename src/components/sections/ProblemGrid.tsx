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
              className="card-elevated flex flex-col items-center gap-3 rounded-2xl bg-white p-5 text-center transition-transform hover:-translate-y-0.5"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-900/5 text-navy-900">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold text-navy-800">{probleme.label}</span>
            </a>
          );
        })}
      </div>
    </Section>
  );
}
