// All UI text goes through t(). The English text is the key; other languages
// add a table below with one row per string. Values like names and counts are
// passed as {placeholders} so user data never becomes part of a translated sentence.
//
// To add a language: add `ta: { 'Show QR': '…', … }` to TABLES, mark machine
// translations for native review, and add it to the Settings language list.

const TABLES = {
  en: {},
};

let lang = 'en';

export function setLanguage(code) {
  lang = TABLES[code] ? code : 'en';
  document.documentElement.lang = lang;
}

export function t(text, vars) {
  let out = TABLES[lang]?.[text] ?? text;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return out;
}

/** Plural helper: tn(n, '{n} field', '{n} fields'). */
export function tn(n, one, many, vars = {}) {
  return t(n === 1 ? one : many, { n, ...vars });
}
