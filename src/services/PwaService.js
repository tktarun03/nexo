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

export async function swStatus() {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return import.meta.env.DEV ? 'dev' : 'not-registered';
  return reg.active ? 'active' : 'installing';
}
