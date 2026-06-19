/**
 * Category + chrome SVG icons, ported verbatim from the approved prototype
 * (LIQO_App_Prototype.html). Stroke/fill come from the .tile / .fan CSS rules,
 * so the markup here stays presentation-free.
 */
import type { JSX } from "react";

export type IconKey = "ac" | "tv" | "fr" | "wm";

/** Maps a questionnaire category id to its prototype icon key. */
export const CATEGORY_ICON: Record<string, IconKey> = {
  ac: "ac",
  tv: "tv",
  fridge: "fr",
  wm: "wm",
};

export function CategoryIcon({ icon }: { icon: IconKey }): JSX.Element {
  switch (icon) {
    case "ac":
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
          <rect x="6" y="10" width="36" height="16" rx="4" />
          <line x1="12" y1="20" x2="36" y2="20" />
          <path d="M14 32c0 4-3 4-3 7M24 32c0 4-3 4-3 7M34 32c0 4-3 4-3 7" />
        </svg>
      );
    case "tv":
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
          <rect x="6" y="9" width="36" height="24" rx="3" />
          <line x1="16" y1="40" x2="32" y2="40" />
          <line x1="24" y1="33" x2="24" y2="40" />
        </svg>
      );
    case "fr":
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
          <rect x="12" y="5" width="24" height="38" rx="4" />
          <line x1="12" y1="19" x2="36" y2="19" />
          <line x1="17" y1="11" x2="17" y2="15" />
          <line x1="17" y1="25" x2="17" y2="32" />
        </svg>
      );
    case "wm":
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
          <rect x="8" y="6" width="32" height="36" rx="4" />
          <circle cx="24" cy="26" r="9" />
          <path d="M17 26c3-3 11 3 14 0" />
          <circle cx="14" cy="11" r="1.6" />
          <circle cx="20" cy="11" r="1.6" />
        </svg>
      );
  }
}

/** Spinner fan used by the Analysing screen (animated via .fan svg CSS). */
export function SpinnerFan(): JSX.Element {
  return (
    <svg viewBox="0 0 64 64" fill="#F6A21E" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="5" fill="#fff" />
      <path
        d="M32 30c-2-9 1-17 7-21 4 6 3 15-3 20l-4 1zM30 32c-9 2-17-1-21-7 6-4 15-3 20 3l1 4zM34 34c9-2 17 1 21 7-6 4-15 3-20-3l-1-4zM32 34c2 9-1 17-7 21-4-6-3-15 3-20l4-1z"
        opacity=".95"
      />
    </svg>
  );
}
