/**
 * Tag taxonomy for the LIQO engine.
 *
 * The questionnaire emits flat option tags (e.g. "t15", "front", "quiet",
 * "b:Voltas"). The engine classifies each tag so it knows what is a HARD fit
 * gate (capacity, form) versus a SOFT preference (features, eco) versus brand.
 *
 * The "why this fits you" copy is generated ONLY from matched fit tags here —
 * never from margin or volume.
 */
import type { Category } from "./types";

/** Ordinal capacity classes per category (1 = smallest). */
export const CAPACITY_ORDINAL: Record<Category, Record<string, number>> = {
  ac: { t10: 1, t15: 2, t20: 3 },
  tv: { s43: 1, s55: 2, s65: 3 },
  fridge: { c250: 1, c330: 2, c400: 3 },
  wm: { k65: 1, k7: 2, k8: 3 },
};

/** Form-factor tags that act as a HARD gate when the customer picks one. */
export const FORM_TAGS: Record<Category, string[]> = {
  ac: ["window", "hotcold"],
  tv: [],
  fridge: ["sd", "dd", "sbs"],
  wm: ["semi", "top", "front", "wd"],
};

/** wd (washer-dryer) satisfies a "front" must-have. */
export const FORM_SATISFIES: Record<string, string[]> = {
  front: ["front", "wd"],
  wd: ["wd"],
  top: ["top"],
  semi: ["semi"],
  sd: ["sd"],
  dd: ["dd"],
  sbs: ["sbs"],
  window: ["window"],
  hotcold: ["hotcold"],
};

export function isBrandTag(tag: string): boolean {
  return tag.startsWith("b:");
}
export function brandOf(tag: string): string {
  return tag.slice(2);
}
export function isEcoTag(tag: string): boolean {
  return /^eco[1-5]$/.test(tag);
}

/** Human phrases for matched fit tags — EN + HI. Used ONLY for fit copy. */
export const FIT_PHRASES: Record<string, { en: string; hi: string }> = {
  // capacity / size
  t10: { en: "right size for a small room", hi: "छोटे कमरे के लिए सही साइज़" },
  t15: { en: "right size for your room", hi: "आपके कमरे के लिए सही साइज़" },
  t20: { en: "sized for your hall", hi: "आपके हॉल के लिए सही" },
  s43: { en: "ideal screen size for your distance", hi: "आपकी दूरी के लिए सही स्क्रीन" },
  s55: { en: "ideal screen size for your distance", hi: "आपकी दूरी के लिए सही स्क्रीन" },
  s65: { en: "cinematic size for your room", hi: "आपके कमरे के लिए सिनेमाई साइज़" },
  c250: { en: "right capacity for your family", hi: "आपके परिवार के लिए सही क्षमता" },
  c330: { en: "right family capacity", hi: "परिवार के लिए सही क्षमता" },
  c400: { en: "big-family capacity", hi: "बड़े परिवार की क्षमता" },
  k65: { en: "right drum size", hi: "सही ड्रम साइज़" },
  k7: { en: "right drum size for your family", hi: "परिवार के लिए सही ड्रम" },
  k8: { en: "family-size drum", hi: "परिवार-आकार ड्रम" },
  // form
  sd: { en: "compact single-door you wanted", hi: "आपकी पसंद का सिंगल डोर" },
  dd: { en: "the double-door you wanted", hi: "आपकी पसंद का डबल डोर" },
  sbs: { en: "premium side-by-side", hi: "प्रीमियम साइड-बाय-साइड" },
  semi: { en: "budget-friendly semi-automatic", hi: "किफ़ायती सेमी-ऑटोमैटिक" },
  top: { en: "easy top loading", hi: "आसान टॉप लोडिंग" },
  front: { en: "front-load wash quality", hi: "फ्रंट-लोड धुलाई गुणवत्ता" },
  wd: { en: "washes and dries in one", hi: "एक में धुलाई और सुखाई" },
  window: { en: "window-fit AC", hi: "विंडो-फिट एसी" },
  hotcold: { en: "heats and cools", hi: "गर्म और ठंडा दोनों" },
  // eco / efficiency
  eco5: { en: "lowest running cost", hi: "सबसे कम चलने की लागत" },
  eco4: { en: "efficient for daily use", hi: "रोज़ाना के लिए किफ़ायती" },
  eco3: { en: "balanced efficiency", hi: "संतुलित दक्षता" },
  // soft features
  fastcool: { en: "fast cooling", hi: "तेज़ कूलिंग" },
  quiet: { en: "quiet at night", hi: "रात में शांत" },
  purify: { en: "cleaner, healthier air", hi: "स्वच्छ हवा" },
  copper: { en: "durable copper build", hi: "टिकाऊ कॉपर" },
  highheat: { en: "handles extreme heat", hi: "अत्यधिक गर्मी में सक्षम" },
  hdr: { en: "great for movies & OTT", hi: "फ़िल्मों व ओटीटी के लिए बढ़िया" },
  smooth: { en: "smooth for sports", hi: "खेल के लिए स्मूद" },
  game: { en: "gaming-ready", hi: "गेमिंग के लिए तैयार" },
  panel: { en: "richer picture grade", hi: "बेहतर पिक्चर" },
  upscale: { en: "sharp on cable channels", hi: "केबल चैनलों पर शार्प" },
  sound: { en: "strong built-in sound", hi: "तेज़ बिल्ट-इन साउंड" },
  smarttv: { en: "smart apps built in", hi: "स्मार्ट ऐप्स" },
  fresh: { en: "keeps veggies fresher", hi: "सब्ज़ियाँ ताज़ा रखे" },
  stable: { en: "stable, reliable cooling", hi: "भरोसेमंद कूलिंग" },
  retain: { en: "holds cooling in power cuts", hi: "बिजली कटौती में ठंडक बनाए रखे" },
  frz: { en: "flexible freezer space", hi: "लचीला फ्रीज़र" },
  steam: { en: "gentle on delicates", hi: "नाज़ुक कपड़ों पर कोमल" },
  rpm: { en: "faster drying spin", hi: "तेज़ सुखाने वाला स्पिन" },
  hardwater: { en: "hard-water ready", hi: "कठोर पानी के लिए तैयार" },
  sizeup: { en: "the bigger screen you wanted", hi: "आपकी पसंद की बड़ी स्क्रीन" },
};

export function fitPhrase(tag: string, lang: "en" | "hi" = "en"): string | null {
  const p = FIT_PHRASES[tag];
  return p ? p[lang] : null;
}
