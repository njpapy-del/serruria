import { siteConfig } from "@/data/site-config";
import { PhoneCTA } from "@/components/ui/PhoneCTA";
import { QuoteCTA } from "@/components/ui/QuoteCTA";
import { CheckCircle2 } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-navy-radial text-white">
      <div className="container-srr grid gap-10 py-14 lg:grid-cols-2 lg:items-center lg:py-24">
        <div>
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

        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-white/10 card-elevated lg:aspect-square">
          <video
            className="h-full w-full object-cover"
            src={siteConfig.hero.videoSrc}
            poster={siteConfig.hero.posterSrc}
            muted
            autoPlay
            loop
            playsInline
            preload="none"
          />
        </div>
      </div>
    </section>
  );
}
