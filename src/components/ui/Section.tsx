import type { ReactNode } from "react";

export function Section({
  id,
  className = "",
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`py-16 lg:py-24 ${className}`}>
      <div className="container-srr">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  center = true,
  tone = "light",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  center?: boolean;
  /** "light" = section à fond clair (titre foncé) ; "dark" = section à fond bleu nuit (titre blanc). */
  tone?: "light" | "dark";
}) {
  const titleColor = tone === "dark" ? "text-white" : "text-navy-900";
  const descriptionColor = tone === "dark" ? "text-slate-300" : "text-slate-500";

  return (
    <div className={`mb-10 lg:mb-14 ${center ? "text-center" : ""}`}>
      {eyebrow ? (
        <p className="mb-2 text-sm font-bold uppercase tracking-widest text-amber-600">
          {eyebrow}
        </p>
      ) : null}
      <h2 className={`text-3xl font-extrabold tracking-tight lg:text-4xl ${titleColor}`}>
        {title}
      </h2>
      {description ? (
        <p className={`mt-4 text-lg ${descriptionColor} ${center ? "mx-auto max-w-2xl" : "max-w-2xl"}`}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
