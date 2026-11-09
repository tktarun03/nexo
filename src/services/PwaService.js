// Service worker registration and install hints.
export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function isIOS() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** iPhone/iPad Safari tab (not yet added to the Home Screen). */
export function isIosSafariTab() {
  return isIOS() && !isStandalone();
}

let registration = null;

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return null;
  try {
    const { registerSW } = await import('virtual:pwa-register');
    registerSW({
      immediate: true,
      onRegisteredSW(_url, reg) {
        registration = reg || null;
      },
    });
  } catch {
    /* offline support is a bonus; the app still works online */
  }
  return registration;
}

/**
 * Ask the server for a newer app version.
 * @returns {Promise<'updating'|'current'|'offline'|'no-sw'>}
 */
export async function checkForUpdate() {
  if (navigator.onLine === false) return 'offline';
  if (!('serviceWorker' in navigator)) return 'no-sw';
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return 'no-sw';
  await reg.update();
  if (reg.installing || reg.waiting) {
    // autoUpdate activates the new worker; reload once it takes control (with a fallback).
    let done = false;
    const reload = () => {
      if (done) return;
      done = true;
      location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
    reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
    setTimeout(reload, 5000);
    return 'updating';
  }
  return 'current';
}

export async function swStatus() {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return import.meta.env.DEV ? 'dev' : 'not-registered';
  return reg.active ? 'active' : 'installing';
}
