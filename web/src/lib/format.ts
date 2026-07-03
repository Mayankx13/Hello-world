/** Small presentation helpers shared across screens (new file — no contract change). */

/** ₹ + Indian-grouped integer, e.g. 41990 -> "₹41,990". */
export function rupees(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

/**
 * Localised "Up to ₹X" / "₹X–Y" / "Above ₹X" label for a price-band tuple.
 * The engine bands are [min, max); we render the human range from the tuple.
 */
export function bandRangeLabel(tuple: [number, number], lang: "en" | "hi" = "en"): string {
  const [min, max] = tuple;
  if (min <= 0) return lang === "hi" ? `${rupees(max)} तक` : `Up to ${rupees(max)}`;
  if (max >= 1_000_000) return lang === "hi" ? `${rupees(min)} से ऊपर` : `Above ${rupees(min)}`;
  return `${rupees(min)}–${rupees(max)}`;
}
