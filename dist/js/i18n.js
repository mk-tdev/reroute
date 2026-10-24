import en from "./locales/en.js";

// Locales register themselves lazily so the default bundle stays small.
const loaders = { en: async () => en, ar: async () => (await import("./locales/ar.js")).default };
const rtl = new Set(["ar"]);
let strings = en;
let current = "en";

export const supportedLocales = Object.keys(loaders);
export const locale = () => current;
export const isRtl = () => rtl.has(current);

export async function setLocale(code) {
  const next = loaders[code] ? code : "en";
  strings = await loaders[next]();
  current = next;
  document.documentElement.lang = next;
  document.documentElement.dir = rtl.has(next) ? "rtl" : "ltr";
  return next;
}

// t("key", {name: "x"}) → string with {name} placeholders filled. Missing keys fall back
// to English, then to the key itself so gaps are visible during review.
export function t(key, vars) {
  let text = strings[key] ?? en[key] ?? key;
  if (typeof text === "function") text = text(vars ?? {});
  if (vars) text = text.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? vars[name] : `{${name}}`));
  return text;
}

// Locale-aware numbers ("٣" in Arabic) for counts shown in the interface.
export const num = (value) => new Intl.NumberFormat(current === "ar" ? "ar-AE" : "en").format(value);
