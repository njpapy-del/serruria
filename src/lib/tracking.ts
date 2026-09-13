// Helpers de tracking Google Ads / GA4 via Google Tag Manager.
// Aucun identifiant de conversion n'est en dur ici : GA4 et les conversions
// Google Ads se configurent dans le conteneur GTM (voir NEXT_PUBLIC_GTM_ID).

export type TrackingEvent =
  | "phone_click"
  | "lead_form_start"
  | "lead_form_submit"
  | "whatsapp_click"
  | "quote_request";

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function pushEvent(event: TrackingEvent, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}

/**
 * État de consentement RGPD (Consent Mode v2) poussé dans le dataLayer.
 * Le conteneur GTM doit être configuré pour lire ces variables et piloter
 * le déclenchement de GA4 / Google Ads en conséquence.
 */
export function pushConsentState(granted: boolean) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "consent_update",
    consent_analytics: granted ? "granted" : "denied",
    consent_ads: granted ? "granted" : "denied",
  });
}
