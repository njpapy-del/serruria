import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "./globals.css";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { buildMetadata } from "@/lib/seo";
import { siteConfig } from "@/data/site-config";

export const metadata: Metadata = {
  ...buildMetadata({
    title: `${siteConfig.brand.name} — ${siteConfig.brand.positioning}`,
  }),
  metadataBase: new URL(siteConfig.siteUrl),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const gtmId = siteConfig.tracking.gtmId;

  return (
    <html lang="fr">
      <body className="antialiased">
        {gtmId ? (
          <>
            <Script id="gtm-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                window.dataLayer.push({
                  event: "consent_update",
                  consent_analytics: "denied",
                  consent_ads: "denied",
                });
                (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer','${gtmId}');
              `}
            </Script>
            <noscript>
              <iframe
                src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
                height="0"
                width="0"
                style={{ display: "none", visibility: "hidden" }}
                title="Google Tag Manager"
              />
            </noscript>
          </>
        ) : null}

        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
