import './styles/tokens.css';
import './styles/global.css';
import './styles/cards.css';
import './styles/screens.css';
import './styles/animations.css';

import { h } from './utils/dom.js';
import { t, setLanguage } from './utils/i18n.js';
import { defineRoute, startRouter, go, back, backTo, refresh, currentPath } from './router.js';
import { state, load, enterDemo, exitDemo, deviceHasProfile } from './state.js';
import { toast } from './components/Toast.js';
import { icon } from './components/Icon.js';
import { onStorageError } from './services/StorageService.js';
import { applyAppearance, getSettings, setSettings } from './services/SettingsService.js';
import { registerServiceWorker, checkForUpdate } from './services/PwaService.js';
import { createTabBar } from './components/TabBar.js';
import { VERSION, RELEASES } from './version.js';

defineRoute('/welcome', () => import('./screens/welcome.js'));
defineRoute('/onboarding', () => import('./screens/onboarding.js'));
defineRoute('/home', () => import('./screens/home.js'));
defineRoute('/profile', () => import('./screens/profile.js'));
defineRoute('/card/:id', () => import('./screens/card.js'));
defineRoute('/share/:id', () => import('./screens/share.js'));
defineRoute('/review/:id', () => import('./screens/review.js'));
defineRoute('/qr/:id', () => import('./screens/qr.js'));
defineRoute('/scan', () => import('./screens/scan.js'));
defineRoute('/settings', () => import('./screens/settings.js'));
defineRoute('/about', () => import('./screens/about.js'));

const OPEN_WITHOUT_PROFILE = ['/welcome', '/onboarding', '/about', '/scan'];

let tabBar = null;

const ctx = {
  state,
  go,
  back,
  currentPath,
  onRoute: (path) => tabBar?.update(path),
  /** Refresh: fetch a newer app version if there is one, otherwise reload saved data. */
  async refreshApp(button) {
    if (button?.classList.contains('spinning')) return;
    button?.classList.add('spinning');
    button?.setAttribute('aria-busy', 'true');
    try {
      const result = await checkForUpdate();
      if (result === 'updating') {
        toast(t('Updating NEXO…'), { body: t('The app will reload in a moment.') });
        return;
      }
      await load();
      await refresh();
      if (result === 'offline') toast(t('You’re offline'), { body: t('Showing what’s saved on this phone.') });
      else toast(t('Up to date'), { kind: 'good', body: t('Version {v} · your cards were reloaded', { v: VERSION }) });
    } catch {
      toast(t('Couldn’t check for updates'), { kind: 'bad', body: t('Check your connection and try again.'), action: { label: t('Retry'), fn: () => ctx.refreshApp() } });
    } finally {
      button?.classList.remove('spinning');
      button?.removeAttribute('aria-busy');
    }
  },
  closeTo: backTo,
  refreshSoon: () => setTimeout(() => refresh(), 0),
  defaultPath: () => (state.mode === 'demo' || deviceHasProfile() ? '/home' : '/welcome'),
  guard(path) {
    const has = state.mode === 'demo' || deviceHasProfile();
    if (!has && !OPEN_WITHOUT_PROFILE.includes(path)) return '/welcome';
    if (has && (path === '/welcome' || path === '/onboarding')) return '/home';
    return path;
  },
  async startDemo() {
    await enterDemo();
    go('/home', { replace: true });
    toast(t('Welcome to the demo'), { body: t('Try anything — nothing is saved.') });
  },
  async exitDemo() {
    await exitDemo();
    go(ctx.defaultPath(), { replace: true, direction: 'back' });
    toast(t('Left the demo'), { body: t('Nothing from the demo was kept.') });
  },
  notFound(message) {
    return ctx.errorScreen(new Error(message), t('Not found'));
  },
  errorScreen(err, title = t('Something went wrong')) {
    const el = h(
      'section',
      { class: 'empty full' },
      h('div', { class: 'big-icon' }, icon('CircleAlert', { size: 28 })),
      h('h2', null, title),
      h('p', null, err?.message || t('Please try again.')),
      h('button', { type: 'button', class: 'btn primary', onclick: () => go(ctx.defaultPath(), { replace: true }) }, t('Go home')),
    );
    return { el, title };
  },
};

function hideSplash() {
  const s = document.getElementById('splash');
  if (!s) return;
  s.classList.add('gone');
  setTimeout(() => s.remove(), 400);
}

function updateNotice() {
  const s = getSettings();
  if (!s.lastSeenVersion) {
    setSettings({ lastSeenVersion: VERSION }); // first install: no notice
    return;
  }
  if (s.lastSeenVersion !== VERSION) {
    setSettings({ lastSeenVersion: VERSION });
    const notes = RELEASES.find((r) => r.version === VERSION)?.notes || [];
    toast(t('Updated to version {v}', { v: VERSION }), {
      body: notes[0] ? t(notes[0]) : '',
      action: { label: t('What’s new'), fn: async () => (await import('./screens/settings.js')).openWhatsNew(ctx) },
    });
  }
}

function backupReminder() {
  if (state.mode !== 'device' || !deviceHasProfile()) return;
  const s = getSettings();
  const DAY = 86400000;
  const firstUse = Math.min(Date.now(), ...state.cards.map((c) => c.createdAt));
  const due = s.lastBackupAt ? Date.now() - s.lastBackupAt > 30 * DAY : Date.now() - firstUse > 3 * DAY;
  const snoozed = Date.now() - s.backupReminderDismissedAt < 7 * DAY;
  if (due && !snoozed) {
    setSettings({ backupReminderDismissedAt: Date.now() });
    toast(t('Time for a backup?'), {
      body: t('Your cards live only on this device.'),
      action: { label: t('Back up'), fn: async () => (await import('./screens/settings.js')).makeBackup() },
    });
  }
}

async function boot() {
  setLanguage('en');
  applyAppearance();
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', applyAppearance);

  onStorageError(() => {
    toast(t('Couldn’t save'), {
      kind: 'bad',
      body: t('Storage is full or blocked. Make a backup now.'),
      action: { label: t('Back up'), fn: async () => (await import('./screens/settings.js')).makeBackup() },
    });
  });

  try {
    await load();
  } catch {
    // IndexedDB unavailable (very old browser / locked-down private mode): run on the demo store
    await enterDemo();
    setTimeout(() => toast(t('Storage unavailable'), { kind: 'bad', body: t('This browser blocked local storage, so NEXO opened the demo. Nothing will be saved.') }), 600);
  }

  tabBar = createTabBar(ctx);
  await startRouter(document.getElementById('app'), ctx);
  hideSplash();
  updateNotice();
  setTimeout(backupReminder, 2500);
  registerServiceWorker();

  // Re-run the guard if the data was changed in another tab.
  window.addEventListener('storage', (e) => {
    if (e.key === 'nexo.settings') applyAppearance();
  });
  if (import.meta.env.DEV) window.__nexo = { state, go, currentPath };
}

boot().catch(() => {
  hideSplash();
  document.getElementById('app').append(ctx.errorScreen(new Error(t('NEXO couldn’t start. Reload to try again.'))).el);
});
