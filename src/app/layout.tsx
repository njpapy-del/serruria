import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "./globals.css";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { buildMetadata, localBusinessJsonLd } from "@/lib/seo";
import { siteConfig } from "@/data/site-config";

export const metadata: Metadata = {
  ...buildMetadata({
    title: `${siteConfig.brand.name} — ${siteConfig.brand.positioning}`,
  }),
  metadataBase: new URL(siteConfig.siteUrl),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const gtmId = siteConfig.tracking.gtmId;
  const jsonLd = localBusinessJsonLd();

  return (
    <html lang="fr">
      <body className="antialiased">
        {jsonLd ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        ) : null}

        {gtmId ? (
          <>
            <Script id="gtm-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){window.dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('consent', 'default', {
                  'ad_storage': 'denied',
                  'ad_user_data': 'denied',
                  'ad_personalization': 'denied',
                  'analytics_storage': 'denied'
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
