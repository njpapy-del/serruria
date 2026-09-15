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
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function pushEvent(event: TrackingEvent, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}

/**
 * État de consentement RGPD (Google Consent Mode v2), signaux standard
 * reconnus nativement par GTM : ad_storage, ad_user_data, ad_personalization,
 * analytics_storage. `gtag` est le shim défini dans layout.tsx (simple
 * relais vers dataLayer.push, pas la librairie gtag.js) ; on retombe sur un
 * push direct au même format si jamais il n'est pas encore défini.
 */
export function pushConsentState(granted: boolean) {
  if (typeof window === "undefined") return;
  const consentValue = granted ? "granted" : "denied";
  const params = {
    ad_storage: consentValue,
    ad_user_data: consentValue,
    ad_personalization: consentValue,
    analytics_storage: consentValue,
  };

  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag === "function") {
    window.gtag("consent", "update", params);
  } else {
    window.dataLayer.push(["consent", "update", params]);
  }
}
