import { siteConfig } from "@/data/site-config";

export function PromoBar() {
  const { promo } = siteConfig;
  if (!promo) return null;

  const item = (key: number) => (
    <span key={key} className="mx-6 inline-flex items-center gap-2 text-sm font-bold">
      {promo.text}
      <span className="rounded-full bg-navy-950/90 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-300">
        {promo.tag}
      </span>
    </span>
  );

  return (
    <div className="overflow-hidden bg-amber-500 py-2 text-navy-950">
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
