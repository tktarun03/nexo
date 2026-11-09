// Live share preview — exactly what the other person receives.
import { h } from '../utils/dom.js';
import { t, tn } from '../utils/i18n.js';
import { icon } from '../components/Icon.js';
import { TopBar } from '../components/Controls.js';
import { state, getCard } from '../state.js';
import { listShareItems, resolveSelection, buildSharePayload, payloadRows, payloadIsEmpty, PRESETS } from '../services/ContactService.js';

export function previewList(rows) {
  return h(
    'ul',
    { class: 'preview-list', 'data-testid': 'sharing-list' },
    rows.map((r) =>
      h(
        'li',
        null,
        h('span', { class: 'row-icon' }, icon(r.icon, { size: 18 })),
        h('span', { class: 'row-text' }, h('span', { class: 'row-detail' }, r.label), h('span', { class: 'row-title' }, r.value)),
      ),
    ),
  );
}

export async function render(ctx, { id }) {
  const card = getCard(id);
  if (!card) return ctx.notFound(t('This card no longer exists.'));
  const profile = state.profile;
  const opts = { hasPhoto: Boolean(profile.photoId) };
  const selection = resolveSelection(card, profile, opts);
  const data = buildSharePayload(profile, selection);
  const rows = payloadRows(data);
  const excluded = listShareItems(profile, opts).filter((it) => !selection[it.key]);
  const empty = payloadIsEmpty(data);

  const notShared = excluded.length
    ? h(
        'details',
        { class: 'not-shared', 'data-testid': 'not-shared' },
        h('summary', null, icon('EyeOff', { size: 18 }), h('span', null, tn(excluded.length, 'Not being shared ({n})', 'Not being shared ({n})')), icon('ChevronDown', { size: 18, class: 'chev' })),
        h('p', { class: 'muted small' }, t('These stay on your phone. They are not in the QR.')),
        h('ul', { class: 'excluded-list' }, excluded.map((it) => h('li', null, icon(it.icon, { size: 16 }), h('span', null, it.label)))),
      )
    : null;

  const el = h(
    'section',
    { class: 'review-screen' },
    TopBar({ title: t('Review'), onBack: () => ctx.back() }),
    h(
      'div',
      { class: 'scroll has-actionbar', 'data-scroll': '' },
      h(
        'div',
        { class: 'wrap stack' },
        h('div', { class: 'preset-tag' }, icon('ShieldCheck', { size: 16 }), h('span', null, `${t(PRESETS[card.preset]?.label || 'Custom sharing')} · ${card.title}`)),
        h('blockquote', { class: 'explain' }, t('Scan this QR to receive the contact details I have selected to share.')),
        h('h2', { class: 'section-title' }, t('You are sharing')),
        empty
          ? h('div', { class: 'note warn' }, icon('CircleAlert', { size: 18 }), h('span', null, t('Nothing is selected. Switch on at least one detail.')))
          : h('div', { class: 'group' }, previewList(rows)),
        notShared,
        h(
          'div',
          { class: 'note' },
          icon('Lock', { size: 18 }),
          h(
            'span',
            null,
            t('Anyone who sees or photographs this QR can copy these details. A QR made offline can’t be taken back after it’s scanned.'),
          ),
        ),
      ),
    ),
    h(
      'footer',
      { class: 'action-bar solid' },
      h('button', { type: 'button', class: 'btn secondary', onclick: () => ctx.back() }, icon('SlidersHorizontal', { size: 18 }), t('Edit')),
      h('button', { type: 'button', class: 'btn primary', disabled: empty, onclick: () => ctx.go(`/qr/${card.id}`), 'data-testid': 'generate-qr' }, icon('QrCode', { size: 18 }), t('Show QR')),
    ),
  );
  return { el, title: t('Review') };
}
