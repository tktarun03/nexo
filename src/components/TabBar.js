// Floating bottom tab bar: Cards · Scan · [Show QR] · Profile · Settings.
// One persistent element (outside #app) so it doesn't re-animate on every screen.
import { h } from '../utils/dom.js';
import { t } from '../utils/i18n.js';
import { icon } from './Icon.js';
import { state, getPhoto } from '../state.js';
import { photoURL } from '../services/PhotoService.js';
import { getSettings } from '../services/SettingsService.js';

/** Screens that show the tab bar, and which tab they belong to. */
const TAB_OF = { '/home': 'home', '/profile': 'profile', '/settings': 'settings', '/about': 'settings' };
const ROOTS = ['/home', '/profile', '/settings'];

export function createTabBar(ctx) {
  const profileIcon = h('span', { class: 'tab-icon' });
  const tabs = {
    home: tab('home', 'Layers', t('Cards'), '/home'),
    scan: tab('scan', 'ScanLine', t('Scan'), '/scan'),
    profile: tab('profile', null, t('Profile'), '/profile', profileIcon),
    settings: tab('settings', 'Settings', t('Settings'), '/settings'),
  };
  const qr = h(
    'button',
    { type: 'button', class: 'tab tab-qr', 'aria-label': t('Show QR'), 'data-testid': 'show-qr', onclick: showQR },
    h('span', { class: 'tab-qr-btn' }, icon('QrCode', { size: 26, stroke: 2 })),
    h('span', { class: 'tab-label' }, t('Show QR')),
  );
  const nav = h('nav', { id: 'tabbar', class: 'tabbar', 'aria-label': t('Main') }, tabs.home.el, tabs.scan.el, qr, tabs.profile.el, tabs.settings.el);
  document.body.append(nav);

  function tab(id, iconName, label, path, iconEl) {
    const el = h(
      'button',
      {
        type: 'button',
        class: 'tab',
        'data-testid': `tab-${id}`,
        onclick: () => {
          const from = ctx.currentPath();
          if (from === path) return;
          // Switching between top-level tabs replaces the entry, so Back doesn't cycle tabs.
          ctx.go(path, { replace: ROOTS.includes(from) && ROOTS.includes(path), direction: 'none' });
        },
      },
      iconEl || h('span', { class: 'tab-icon' }, icon(iconName, { size: 23 })),
      h('span', { class: 'tab-label' }, label),
    );
    return { el, path };
  }

  function activeCard() {
    const id = getSettings().selectedCardId;
    return state.cards.find((c) => c.id === id) || state.cards[0] || null;
  }

  function showQR() {
    const card = activeCard();
    ctx.go(card ? `/qr/${card.id}` : '/card/new');
  }

  function update(path) {
    const current = TAB_OF[path];
    document.documentElement.classList.toggle('has-tabbar', Boolean(current));
    for (const [id, tb] of Object.entries(tabs)) {
      const on = id === current;
      tb.el.classList.toggle('on', on);
      if (on) tb.el.setAttribute('aria-current', 'page');
      else tb.el.removeAttribute('aria-current');
    }
    const ph = getPhoto(state.profile?.photoId);
    profileIcon.replaceChildren(ph ? h('img', { class: 'tab-avatar', src: photoURL(ph), alt: '' }) : icon('User', { size: 23 }));
    qr.disabled = !state.profile;
  }

  // Hide while typing so it never sits on top of the iOS keyboard.
  const isField = (el) => el && el.matches?.('input:not([type=checkbox]):not([type=range]):not([type=file]), textarea, select');
  document.addEventListener('focusin', (e) => {
    if (isField(e.target)) document.documentElement.classList.add('kb-open');
  });
  document.addEventListener('focusout', (e) => {
    if (isField(e.target)) setTimeout(() => {
      if (!isField(document.activeElement)) document.documentElement.classList.remove('kb-open');
    }, 50);
  });

  return { el: nav, update };
}
