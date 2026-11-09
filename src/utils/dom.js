// Tiny, safe DOM builder. Strings always become text nodes — never HTML — so
// user and scanned data can't inject markup. The only innerHTML in the app is
// for trusted, app-generated SVG (QR codes, brand art), see setTrustedSVG().

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) applyAttrs(el, attrs);
  append(el, children);
  return el;
}

function applyAttrs(el, attrs) {
  for (const [key, val] of Object.entries(attrs)) {
    if (val === undefined || val === null || val === false) continue;
    if (key === 'class') el.className = Array.isArray(val) ? val.filter(Boolean).join(' ') : val;
    else if (key === 'style' && typeof val === 'object') Object.assign(el.style, val);
    else if (key === 'dataset') Object.assign(el.dataset, val);
    else if (key.startsWith('on') && typeof val === 'function') el.addEventListener(key.slice(2).toLowerCase(), val);
    else if (key === 'text') el.textContent = String(val);
    else if (key === 'value' && 'value' in el) el.value = val;
    else if (key === 'checked') el.checked = Boolean(val);
    else if (val === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(val));
  }
}

export function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === '') continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

/** Only for SVG produced by the app itself (QR library output, static brand art). */
export function setTrustedSVG(el, svgString) {
  if (!/^\s*<svg[\s>]/.test(svgString) || /<script|on\w+=|javascript:/i.test(svgString)) {
    throw new Error('Refused untrusted SVG');
  }
  el.innerHTML = svgString;
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Light haptic tick where supported (Android). iOS Safari ignores it silently. */
export function haptic(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}
