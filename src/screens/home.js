// Home — the identity card carousel.
import { h } from '../utils/dom.js';
import { t, tn } from '../utils/i18n.js';
import { icon } from '../components/Icon.js';
import { Wordmark } from '../components/Logo.js';
import { IdentityCard } from '../components/IdentityCard.js';
import { CardCarousel } from '../components/CardCarousel.js';
import { openSheet } from '../components/BottomSheet.js';
import { state, cardPhoto, getPhoto } from '../state.js';
import { resolveSelection, buildSharePayload, payloadRows } from '../services/ContactService.js';
import { getSettings, setSettings } from '../services/SettingsService.js';
import { photoURL } from '../services/PhotoService.js';
import { checklist } from './checklist.js';

export function sharedCount(card) {
  const sel = resolveSelection(card, state.profile, { hasPhoto: Boolean(state.profile.photoId) });
  return payloadRows(buildSharePayload(state.profile, sel)).length;
}

export async function render(ctx) {
  const cards = state.cards;
  const settings = getSettings();
  const startIndex = Math.max(0, cards.findIndex((c) => c.id === settings.selectedCardId));
  let active = cards[startIndex] || null;

  const ambient = h('div', { class: 'home-ambient', 'aria-hidden': 'true' });
  const setAmbient = (card) => {
    const tint = cardPhoto(card)?.tint || (card ? getComputedTint(card) : '');
    ambient.style.setProperty('--ambient', tint || '#a6c3d8');
  };

  const slides = cards.map((card) =>
    h(
      'div',
      {
        role: 'button',
        tabindex: '0',
        class: 'card-hit',
        'aria-label': t('Choose what to share from {name}', { name: card.displayName || card.title }),
        onclick: () => ctx.go(`/share/${card.id}`),
        onkeydown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            ctx.go(`/share/${card.id}`);
          }
        },
      },
      IdentityCard(card, {
        photo: cardPhoto(card),
        avatarPhoto: card.photoId ? getPhoto(state.profile.photoId) : null,
        sharedCount: sharedCount(card),
        demo: state.mode === 'demo',
      }),
    ),
  );

  const carousel = CardCarousel({
    slides,
    initialIndex: startIndex,
    onAdd: () => ctx.go('/card/new'),
    onChange: (i) => {
      active = cards[i] || null;
      actionsMain.forEach((b) => (b.disabled = !active));
      if (active) {
        setSettings({ selectedCardId: active.id });
        setAmbient(active);
      }
    },
  });

  const avatar = getPhoto(state.profile?.photoId);
  const head = h(
    'header',
    { class: 'home-head' },
    h(
      'button',
      { type: 'button', class: ['icon-btn', avatar && 'avatar'], 'aria-label': t('My profile'), onclick: () => ctx.go('/profile'), 'data-testid': 'open-profile' },
      avatar ? h('img', { src: photoURL(avatar), alt: '' }) : icon('User'),
    ),
    Wordmark(),
    h(
      'div',
      { class: 'hstack' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('Scan a QR code'), onclick: () => ctx.go('/scan'), 'data-testid': 'open-scan' }, icon('ScanLine')),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('Settings'), onclick: () => ctx.go('/settings'), 'data-testid': 'open-settings' }, icon('Settings')),
    ),
  );

  const editBtn = h('button', { type: 'button', class: 'round', 'aria-label': t('Edit card'), onclick: () => active && ctx.go(`/card/${active.id}`), 'data-testid': 'edit-card' }, icon('Pencil', { size: 21 }));
  const fieldsBtn = h('button', { type: 'button', class: 'round', 'aria-label': t('Choose what to share'), onclick: () => active && ctx.go(`/share/${active.id}`), 'data-testid': 'choose-fields' }, icon('SlidersHorizontal', { size: 21 }));
  const qrBtn = h('button', { type: 'button', class: 'btn primary', onclick: () => active && ctx.go(`/qr/${active.id}`), 'data-testid': 'show-qr' }, icon('QrCode', { size: 20 }), t('Show QR'));
  const actionsMain = [editBtn, fieldsBtn, qrBtn];
  const actions = h('nav', { class: 'action-bar home-actions', 'aria-label': t('Card actions') }, editBtn, qrBtn, fieldsBtn);
  if (!active) actionsMain.forEach((b) => (b.disabled = true));

  const demoBanner = state.mode === 'demo'
    ? h(
        'div',
        { class: 'demo-banner', role: 'note' },
        icon('Sparkles', { size: 16 }),
        h('span', null, t('Demo · nothing is saved')),
        h('button', { type: 'button', class: 'btn sm secondary', onclick: () => ctx.exitDemo(), 'data-testid': 'exit-demo' }, t('Exit demo')),
      )
    : null;

  const list = checklist(ctx);
  const gs = state.mode === 'device' && !settings.checklistHidden && list.done < list.items.length
    ? h(
        'button',
        { type: 'button', class: 'getting-started', onclick: () => openChecklist(ctx, list), 'data-testid': 'get-started' },
        icon('Sparkles', { size: 15 }),
        t('Get started · {done} of {total}', { done: list.done, total: list.items.length }),
      )
    : null;

  const empty = !cards.length
    ? h('p', { class: 'muted center small', style: { margin: '0 24px' } }, t('Swipe to the card on the right to create your first card.'))
    : null;

  const body = h('div', { class: 'home-body' }, demoBanner, gs, carousel.el, empty);
  const el = h('section', { class: 'home', 'aria-label': t('My cards') }, ambient, head, body, actions);
  if (active) setAmbient(active);

  return {
    el,
    title: t('My cards'),
    mounted: () => carousel.mount(),
    destroy: () => carousel.destroy(),
  };
}

const SCENE_TINT = { sky: '#a8c4dc', lake: '#7fb5d6', dusk: '#e3a1a6', forest: '#8fbf86', sand: '#e6c79c', night: '#5a62a8', rose: '#e9a5b8', mint: '#93d8c3' };
function getComputedTint(card) {
  return SCENE_TINT[card.scene] || '#a6c3d8';
}

function openChecklist(ctx, list) {
  const items = list.items.map((it) =>
    h(
      'div',
      { class: ['check-item', it.done && 'done'] },
      h('span', { class: 'tick' }, icon('Check', { size: 16, stroke: 2.5 })),
      h('span', { class: 'check-title' }, it.title),
      it.done ? null : h('button', { type: 'button', class: 'btn sm secondary', onclick: () => it.go() }, it.action),
    ),
  );
  const sheet = openSheet({
    title: t('Get started'),
    content: h(
      'div',
      { class: 'stack' },
      h('p', { class: 'muted small' }, tn(list.items.length - list.done, '{n} step left. Each one ticks itself off.', '{n} steps left. Each one ticks itself off.')),
      h('div', { class: 'checklist' }, items),
      h(
        'button',
        {
          type: 'button',
          class: 'link-btn',
          onclick: () => {
            setSettings({ checklistHidden: true });
            sheet.close();
            ctx.refreshSoon();
          },
        },
        t('Hide this list'),
      ),
    ),
  });
}
