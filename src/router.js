// Hash router with real back-button support and scroll restoration.
// Bottom sheets add a history entry too, so the Back gesture closes a sheet
// before it leaves the screen.
import { clear, prefersReducedMotion } from './utils/dom.js';

const routes = [];
let current = null; // { path, screen, el }
let idx = 0;
const scrollMemory = new Map();
const trail = []; // trail[idx] = path, so we can jump back to an earlier screen
const sheetStack = []; // [{ close(fromHistory) }]
let appRoot = null;
let ctxRef = null;

export function defineRoute(pattern, loader) {
  const keys = [];
  const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (m, k) => (keys.push(k), '([^/]+)'))}$`);
  routes.push({ pattern, re, keys, loader });
}

export function currentPath() {
  const p = location.hash.replace(/^#/, '');
  return p || '/';
}

function match(path) {
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) return { route: r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

export function startRouter(root, ctx) {
  appRoot = root;
  ctxRef = ctx;
  idx = history.state?.idx ?? 0;
  if (!history.state) history.replaceState({ idx, sheetDepth: 0 }, '', location.hash || '#/');
  window.addEventListener('popstate', onPop);
  return render(currentPath(), { direction: 'none' });
}

async function onPop(e) {
  const st = e.state || { idx: 0, sheetDepth: 0 };
  const depth = st.sheetDepth || 0;
  let closedSheet = false;
  while (sheetStack.length > depth) {
    sheetStack.pop().close(true);
    closedSheet = true;
  }
  const back = (st.idx ?? 0) < idx;
  idx = st.idx ?? 0;
  const path = currentPath();
  if (!current || current.path !== path) await render(path, { direction: back ? 'back' : 'forward' });
  else if (!closedSheet && sheetStack.length < depth) {
    // Forward into a sheet entry we no longer have: drop it.
    history.back();
  }
}

/** Navigate. opts.replace replaces the current entry (and any open sheet entry). */
export async function go(path, opts = {}) {
  const closingSheets = sheetStack.length > 0;
  while (sheetStack.length) sheetStack.pop().close(true, { silent: true });
  if (current) scrollMemory.set(current.path, scrollTopOf(current.el));
  if (closingSheets && !opts.replace) {
    // The top entry is a sheet entry sitting above the current screen: reuse it.
    idx += 1;
    history.replaceState({ idx, sheetDepth: 0 }, '', `#${path}`);
  } else if (opts.replace) {
    history.replaceState({ idx, sheetDepth: 0 }, '', `#${path}`);
  } else {
    idx += 1;
    history.pushState({ idx, sheetDepth: 0 }, '', `#${path}`);
  }
  scrollMemory.delete(path);
  return render(path, { direction: opts.direction || (opts.replace ? 'none' : 'forward') });
}

export function back(fallback = '/home') {
  if (idx > 0) history.back();
  else go(fallback, { replace: true, direction: 'back' });
}

/** Return to an earlier screen in history (e.g. QR → Close → Home) without stacking a new entry. */
export function backTo(path) {
  for (let i = idx - 1; i >= 0; i -= 1) {
    if (trail[i] === path) {
      history.go(i - idx);
      return;
    }
  }
  go(path, { replace: true, direction: 'back' });
}

/** Re-render the current screen in place (e.g. after data changed elsewhere). */
export function refresh() {
  if (!current) return null;
  scrollMemory.set(current.path, scrollTopOf(current.el));
  return render(current.path, { direction: 'none', keepScroll: true });
}

function scrollTopOf(el) {
  const sc = el?.querySelector?.('[data-scroll]') || el;
  return sc ? sc.scrollTop : 0;
}

async function render(path, { direction, keepScroll } = {}) {
  let found = match(path);
  if (!found) {
    path = ctxRef.defaultPath();
    history.replaceState({ idx, sheetDepth: 0 }, '', `#${path}`);
    found = match(path);
  }
  const guard = ctxRef.guard?.(path);
  if (guard && guard !== path) {
    history.replaceState({ idx, sheetDepth: 0 }, '', `#${guard}`);
    return render(guard, { direction: 'none' });
  }

  if (current?.screen?.destroy) {
    try {
      await current.screen.destroy();
    } catch {
      /* a screen failing to clean up must never block navigation */
    }
  }

  let screen;
  try {
    const mod = await found.route.loader();
    screen = await mod.render(ctxRef, found.params);
  } catch (err) {
    screen = ctxRef.errorScreen(err);
  }
  const el = screen.el;
  el.classList.add('screen');
  if (!prefersReducedMotion() && direction !== 'none') el.classList.add(direction === 'back' ? 'enter-back' : 'enter-forward');

  clear(appRoot).append(el);
  current = { path, screen, el };
  trail[idx] = path;
  trail.length = idx + 1;

  const saved = scrollMemory.get(path);
  const sc = el.querySelector('[data-scroll]') || el;
  if ((direction === 'back' || keepScroll) && saved) requestAnimationFrame(() => (sc.scrollTop = saved));
  screen.mounted?.();
  if (screen.title) document.title = `${screen.title} · NEXO`;
  else document.title = 'NEXO — Your identity. Your rules.';
  return screen;
}

// ---- sheets ---------------------------------------------------------------

export function pushSheet(entry) {
  sheetStack.push(entry);
  history.pushState({ idx, sheetDepth: sheetStack.length }, '', location.hash);
}

/** Close the top sheet through history so Back and the close button agree. */
export function popSheet(entry) {
  if (sheetStack[sheetStack.length - 1] === entry) history.back();
}

export function openSheetCount() {
  return sheetStack.length;
}
