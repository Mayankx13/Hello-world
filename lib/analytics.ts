/**
 * GTM dataLayer helpers. The Facebook Pixel lives inside the GTM container
 * (a Pixel tag listening for these events) — nothing pixel-specific ships
 * in the bundle. With NEXT_PUBLIC_GTM_ID unset these pushes are no-ops
 * against a plain array.
 */

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export type AnalyticsEvent =
  | "view_sprint_details"
  | "cta_click"
  | "book_sprint";

export function track(
  event: AnalyticsEvent,
  params: Record<string, string | number | boolean> = {}
) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event, ...params });
}

export const trackCtaClick = (ctaId: string, location: string) =>
  track("cta_click", { cta_id: ctaId, cta_location: location });

export const trackViewSprintDetails = () => track("view_sprint_details");

export const trackBookSprint = (meta: { niche: string; frequency: string }) =>
  track("book_sprint", meta);
