// Make the QR as easy to scan as the platform honestly allows.
//
// Web (Safari/Chrome): browsers expose NO API to read or change hardware screen
// brightness. So in the browser we:
//   • show the QR on a pure-white, full-opacity surface (no overlays dimming it), and
//   • hold a Screen Wake Lock (where supported) so the screen doesn't dim or sleep.
// We never claim the hardware brightness was changed.
//
// Native (future Capacitor build): if a brightness plugin with the
// @capacitor-community/screen-brightness API is present at
// window.Capacitor.Plugins.ScreenBrightness, we read the current brightness,
// raise it to 100 %, and restore the exact original value on exit.

function nativeBrightnessPlugin() {
  const plugin = globalThis.Capacitor?.Plugins?.ScreenBrightness;
  return plugin && typeof plugin.setBrightness === 'function' && typeof plugin.getBrightness === 'function' ? plugin : null;
}

class BrightnessServiceImpl {
  constructor() {
    this.active = false;
    this.wakeLock = null;
    this.original = null;
    this.mode = 'web';
    this.onVisibility = this.onVisibility.bind(this);
  }

  /** What this device can do, for honest UI copy. */
  capabilities() {
    return {
      native: Boolean(nativeBrightnessPlugin()),
      wakeLock: typeof navigator !== 'undefined' && 'wakeLock' in navigator,
    };
  }

  /** Enter QR presentation mode. Returns { mode, wakeLock, brightnessRaised }. */
  async enter() {
    if (this.active) return this.status();
    this.active = true;
    document.documentElement.classList.add('qr-presenting');
    document.addEventListener('visibilitychange', this.onVisibility);

    const plugin = nativeBrightnessPlugin();
    if (plugin) {
      try {
        const { brightness } = await plugin.getBrightness();
        this.original = typeof brightness === 'number' ? brightness : null;
        await plugin.setBrightness({ brightness: 1 });
        this.mode = 'native';
      } catch {
        this.mode = 'web';
        this.original = null;
      }
    }
    await this.acquireWakeLock();
    return this.status();
  }

  /** Leave presentation mode and restore everything. Safe to call more than once. */
  async exit() {
    if (!this.active) return;
    this.active = false;
    document.documentElement.classList.remove('qr-presenting');
    document.removeEventListener('visibilitychange', this.onVisibility);
    await this.restoreNative();
    await this.releaseWakeLock();
    this.mode = 'web';
  }

  status() {
    return { mode: this.mode, wakeLock: Boolean(this.wakeLock), brightnessRaised: this.mode === 'native' };
  }

  async acquireWakeLock() {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.wakeLock.addEventListener?.('release', () => {
        this.wakeLock = null;
      });
    } catch {
      this.wakeLock = null; // denied (e.g. low battery mode) — the white surface still helps
    }
  }

  async releaseWakeLock() {
    try {
      await this.wakeLock?.release();
    } catch {
      /* already released */
    }
    this.wakeLock = null;
  }

  async restoreNative() {
    const plugin = nativeBrightnessPlugin();
    if (plugin && this.original !== null) {
      try {
        await plugin.setBrightness({ brightness: this.original });
      } catch {
        /* nothing else we can do */
      }
    }
    this.original = null;
  }

  async onVisibility() {
    if (!this.active) return;
    if (document.visibilityState === 'hidden') {
      // App backgrounded: give the user their brightness back immediately.
      await this.restoreNative();
      await this.releaseWakeLock();
    } else {
      const plugin = nativeBrightnessPlugin();
      if (plugin) {
        try {
          const { brightness } = await plugin.getBrightness();
          this.original = brightness;
          await plugin.setBrightness({ brightness: 1 });
        } catch {
          /* ignore */
        }
      }
      await this.acquireWakeLock();
    }
  }
}

export const BrightnessService = new BrightnessServiceImpl();
