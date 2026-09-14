import { siteConfig } from "@/data/site-config";

export function PromoBar() {
  const { promo } = siteConfig;
  if (!promo) return null;

  const item = (key: number) => (
    <span key={key} className="mx-8 inline-flex items-center gap-3 text-base font-bold text-white sm:text-lg">
      {promo.text}
      <span className="rounded-full bg-amber-400 px-3 py-1 text-sm font-bold uppercase tracking-wide text-navy-950">
        {promo.tag}
      </span>
    </span>
  );

  return (
    <div className="overflow-hidden bg-navy-900 py-3">
      <p className="sr-only">
        {promo.text} — {promo.tag}
      </p>
      <div className="marquee-track flex w-max whitespace-nowrap" aria-hidden="true">
        {[0, 1, 2, 3].map(item)}
        {[4, 5, 6, 7].map(item)}
      </div>
    </div>
  );
}
