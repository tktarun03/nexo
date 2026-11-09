// The immersive portrait identity card.
import { h } from '../utils/dom.js';
import { icon } from './Icon.js';
import { t, tn } from '../utils/i18n.js';
import { initials } from '../utils/misc.js';
import { CARD_TYPES, PRESETS } from '../services/ContactService.js';
import { photoURL } from '../services/PhotoService.js';

/**
 * @param {object} card
 * @param {{photo?:object|null, sharedCount?:number, avatarPhoto?:object|null, demo?:boolean}} opts
 */
export function IdentityCard(card, opts = {}) {
  const type = CARD_TYPES[card.type] || CARD_TYPES.custom;
  const src = opts.photo ? photoURL(opts.photo) : card.staticPhoto || '';
  const tint = opts.photo?.tint || card.tint || '';
  const name = card.displayName || t('Your name');

  const media = src
    ? h('img', { class: 'id-photo', src, alt: '', draggable: 'false', decoding: 'async' })
    : h('div', { class: 'id-scene', 'aria-hidden': 'true' }, h('span', { class: 'id-monogram' }, initials(name)));

  const avatarSrc = opts.avatarPhoto ? photoURL(opts.avatarPhoto) : '';
  const shared = typeof opts.sharedCount === 'number' ? opts.sharedCount : null;

  return h(
    'article',
    {
      class: ['id-card', `scene-${card.scene || 'sky'}`, src && 'has-photo'],
      style: tint ? { '--tint': tint } : null,
      'aria-label': t('{type} card for {name}', { type: t(type.label), name }),
      'data-card-id': card.id,
    },
    media,
    h('div', { class: 'id-shade', 'aria-hidden': 'true' }),
    h(
      'div',
      { class: 'id-top' },
      h('span', { class: 'glass-pill' }, icon(type.icon, { size: 15 }), h('span', null, card.title || t(type.label))),
      opts.demo ? h('span', { class: 'glass-pill subtle' }, t('Demo')) : null,
    ),
    h(
      'div',
      { class: 'id-bottom' },
      avatarSrc && src !== avatarSrc ? h('img', { class: 'id-avatar', src: avatarSrc, alt: '', draggable: 'false' }) : null,
      h('h2', { class: 'id-name' }, name),
      card.subtitle ? h('p', { class: 'id-sub' }, card.subtitle) : null,
      shared !== null
        ? h(
            'p',
            { class: 'id-meta' },
            icon('ShieldCheck', { size: 14 }),
            h('span', null, `${t(PRESETS[card.preset]?.short || 'Custom')} · ${tn(shared, '{n} detail shared', '{n} details shared')}`),
          )
        : null,
    ),
  );
}
