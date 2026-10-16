import { siteConfig } from "@/data/site-config";
import { PhoneCTA } from "@/components/ui/PhoneCTA";
import { QuoteCTA } from "@/components/ui/QuoteCTA";
import { WhatsAppCTA } from "@/components/ui/WhatsAppCTA";
import { HeroSlogans } from "@/components/sections/HeroSlogans";
import { CheckCircle2 } from "lucide-react";

export function Hero() {
  const prestations = siteConfig.services.slice(0, 4).map((s) => s.label);

  return (
    <section className="relative isolate overflow-hidden text-white lg:min-h-[760px]">
      <video
        className="absolute inset-0 -z-20 h-full w-full object-cover brightness-150 contrast-[1.05] saturate-[1.1]"
        src={siteConfig.hero.videoSrc}
        poster={siteConfig.hero.posterSrc}
        muted
        autoPlay
        loop
        playsInline
        preload="none"
      />
      {/* Overlay bleu nuit pour garantir la lisibilité du texte et des CTA sur la vidéo. */}
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-950/65 via-navy-950/35 to-navy-950/10"
        aria-hidden="true"
      />

      <div className="container-srr flex flex-col justify-center py-8 sm:py-14 lg:min-h-[760px] lg:py-24">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-4 py-1.5 text-sm font-bold tracking-wide text-amber-300">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse-soft" aria-hidden="true" />
            {siteConfig.hero.badge}
          </span>

          {/* Accroche visuelle principale ; le H1 reste la requête recherchée (SEO). */}
          <p className="mt-4 max-w-2xl text-[2.15rem] font-black uppercase leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            {siteConfig.hero.accroche}
          </p>

          <h1 className="mt-3 max-w-xl text-xl font-bold leading-tight text-amber-300 sm:text-2xl">
            {/* Les mots composés (« Île-de-France ») ne sont jamais coupés au trait d'union. */}
            {siteConfig.hero.title.split(" ").map((word, i) => (
              <span key={i} className={word.includes("-") ? "whitespace-nowrap" : undefined}>
                {i > 0 ? " " : ""}
                {word}
              </span>
            ))}
          </h1>

          <div className="mt-4 max-w-xl">
            <HeroSlogans slogans={siteConfig.hero.slogans} />
          </div>

          <p className="mt-3 max-w-xl text-base text-slate-200 sm:text-lg">{siteConfig.hero.subtitle}</p>

          <p className="mt-3 max-w-xl text-sm font-semibold text-amber-300">{prestations.join(" · ")}</p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <PhoneCTA location="hero" size="lg" className="w-full sm:w-auto" />
            <div className="grid grid-cols-2 gap-3 sm:flex">
              <WhatsAppCTA location="hero" size="md" />
              <QuoteCTA
                location="hero"
                className="inline-flex items-center justify-center rounded-full border-2 border-white/80 px-4 py-3 text-center text-[15px] font-bold leading-tight text-white transition-colors hover:bg-white/10 sm:px-5 sm:text-base"
              />
            </div>
          </div>

          <ul className="mt-8 grid max-w-xl grid-cols-2 gap-4 sm:grid-cols-4">
            {siteConfig.trustBullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2 text-sm text-slate-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" aria-hidden="true" />
                {bullet}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
