import { siteConfig } from "@/data/site-config";
import { Section, SectionHeading } from "@/components/ui/Section";
import { PhoneCTA } from "@/components/ui/PhoneCTA";
import { TeamMapClient } from "@/components/sections/TeamMapClient";

const STATUS_LABEL: Record<string, string> = {
  disponible: "Disponible",
  intervention: "En intervention",
};

const STATUS_CLASS: Record<string, string> = {
  disponible: "bg-success-500/10 text-success-500",
  intervention: "bg-amber-500/10 text-amber-600",
};

export function TeamMapSection() {
  const { technicians } = siteConfig.team;

  return (
    <Section id="equipe" className="bg-slate-50">
      <SectionHeading
        eyebrow="En ce moment"
        title="Notre équipe sur le terrain"
        description="Aperçu illustratif de la répartition de nos techniciens dans la région — un vrai serrurier vous répond dès votre appel."
      />

      <div className="grid gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white card-elevated lg:grid-cols-[1.4fr_1fr]">
        <div className="h-[360px] lg:h-[560px]">
          <TeamMapClient />
        </div>

        <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 lg:max-h-[560px]">
          {technicians.map((tech) => (
            <div key={tech.name} className="flex items-start gap-3 p-4">
              <span
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  tech.status === "disponible"
                    ? "bg-success-500 text-white"
                    : "bg-amber-500 text-white"
                }`}
              >
                {tech.initials}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-navy-900">{tech.name}</p>
                  <span
                    className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_CLASS[tech.status]}`}
                  >
                    {STATUS_LABEL[tech.status]}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{tech.zone}</p>
                <p className="mt-1 text-xs text-slate-500">{tech.mission}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-500">{tech.eta}</span>
                  <PhoneCTA
                    location={`team_map_${tech.name}`}
                    size="sm"
                    label="Appeler"
                    className="px-3 py-1.5 text-xs"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
