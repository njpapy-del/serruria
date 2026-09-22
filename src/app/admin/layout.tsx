import type { Metadata } from "next";
import type { ReactNode } from "react";

// Sécurité SEO supplémentaire : même si robots.txt bloque déjà /admin,
// un noindex direct empêche toute indexation si la page était découverte
// par un autre moyen (lien externe, etc.).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
