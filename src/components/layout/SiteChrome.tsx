"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { StickyMobileBar } from "@/components/layout/StickyMobileBar";
import { ConsentBanner } from "@/components/layout/ConsentBanner";
import { NotificationPopup } from "@/components/layout/NotificationPopup";

// L'espace admin a son propre en-tête (voir AdminDashboard) : on n'affiche
// pas le header/footer/popup marketing par-dessus.
export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  if (isAdmin) return <>{children}</>;

  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
      <StickyMobileBar />
      <ConsentBanner />
      <NotificationPopup />
    </>
  );
}
