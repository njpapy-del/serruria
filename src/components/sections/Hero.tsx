import { siteConfig } from "@/data/site-config";
import { PhoneCTA } from "@/components/ui/PhoneCTA";
import { QuoteCTA } from "@/components/ui/QuoteCTA";
import { CheckCircle2 } from "lucide-react";

export function Hero() {
  return (
    <section className="relative isolate min-h-[640px] overflow-hidden text-white lg:min-h-[760px]">
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

      <div className="container-srr flex min-h-[640px] flex-col justify-center py-14 lg:min-h-[760px] lg:py-24">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-4 py-1.5 text-sm font-bold tracking-wide text-amber-300">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse-soft" aria-hidden="true" />
            {siteConfig.hero.badge}
          </span>

          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight lg:text-5xl">
            {siteConfig.hero.title}
          </h1>

          <p className="mt-4 max-w-xl text-lg text-slate-300">{siteConfig.hero.subtitle}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <PhoneCTA location="hero" size="lg" />
            <QuoteCTA location="hero" />
          </div>

          <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
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
