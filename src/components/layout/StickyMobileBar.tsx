import { siteConfig } from "@/data/site-config";
import { PhoneCTA } from "@/components/ui/PhoneCTA";
import { WhatsAppCTA } from "@/components/ui/WhatsAppCTA";

export function StickyMobileBar() {
  const hasWhatsapp = Boolean(siteConfig.contact.whatsappHref);

  return (
    <div
      role="region"
      aria-label="Contacter la serrurerie"
      className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-slate-200 bg-white p-3 shadow-[0_-8px_24px_-16px_rgba(5,8,16,0.35)] lg:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <PhoneCTA
        location="sticky_bar"
        size="bar"
        className={hasWhatsapp ? "flex-[1.4]" : "w-full"}
      />
      {hasWhatsapp ? (
        <WhatsAppCTA location="sticky_bar" size="bar" className="flex-1" />
      ) : null}
    </div>
  );
}
