// Share settings — choose exactly what a QR contains. Privacy first: every
// item has its own switch; presets are shortcuts; changes save to the card and
// update the live QR thumbnail instantly.
import { h, setTrustedSVG, haptic } from '../utils/dom.js';
import { t, tn } from '../utils/i18n.js';
import { icon } from '../components/Icon.js';
import { Switch, TopBar } from '../components/Controls.js';
import { toast } from '../components/Toast.js';
import { state, getCard, saveCard } from '../state.js';
import {
  listShareItems, resolveSelection, selectionForPreset, buildSharePayload, payloadRows, payloadIsEmpty, PRESETS, GROUPS,
} from '../services/ContactService.js';
import { encodeVCard } from '../services/VCard.js';
import { toSVG, analyse } from '../services/QRService.js';
import { debounce, clone } from '../utils/misc.js';

export function sameSelection(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (Boolean(a[k]) !== Boolean(b[k])) return false;
  return true;
}

export async function render(ctx, { id }) {
  const card = getCard(id);
  if (!card) return ctx.notFound(t('This card no longer exists.'));
  const profile = state.profile;
  const opts = { hasPhoto: Boolean(profile.photoId) };
  const items = listShareItems(profile, opts);
  let selection = resolveSelection(card, profile, opts);
  let working = clone(card);

  const persist = debounce(async () => {
    try {
      working = await saveCard({ ...working, shareFields: selection });
    } catch {
      /* storage error toast is shown by the global handler */
    }
  }, 250);

  // ---- live footer ----
  const qrBox = h('div', { class: 'mini-qr', 'aria-hidden': 'true' });
  const countLabel = h('strong');
  const sizeLabel = h('span', { class: 'muted small' });
  const reviewBtn = h('button', { type: 'button', class: 'btn primary', onclick: () => { persist.flush(); ctx.go(`/review/${card.id}`); }, 'data-testid': 'review' }, t('Review'), icon('ChevronRight', { size: 18 }));
  let renderToken = 0;
  async function updateLive() {
    const data = buildSharePayload(profile, selection);
    const n = payloadRows(data).length;
    countLabel.textContent = tn(n, '{n} detail selected', '{n} details selected');
    const text = encodeVCard(data);
    const info = analyse(text);
    sizeLabel.textContent = payloadIsEmpty(data)
      ? t('Nothing selected yet')
      : info.level === 'good' ? t('Easy to scan') : info.level === 'dense' ? t('Dense QR — fewer details scan faster') : t('Too much for one QR');
    reviewBtn.disabled = payloadIsEmpty(data);
    const token = ++renderToken;
    if (info.ok) {
      const svg = await toSVG(text, info.ecl);
      if (token === renderToken) setTrustedSVG(qrBox, svg);
    }
  }

  // ---- presets ----
  const chipRow = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': t('Sharing presets') });
  function renderChips() {
    chipRow.replaceChildren(
      ...Object.entries(PRESETS).map(([pid, p]) =>
        h(
          'button',
          {
            type: 'button',
            role: 'radio',
            'aria-checked': String(working.preset === pid),
            class: ['chip', working.preset === pid && 'on'],
            'data-testid': `preset-${pid}`,
            onclick: () => applyPreset(pid),
          },
          t(p.short),
        ),
      ),
    );
  }
  const presetDesc = h('p', { class: 'muted small preset-desc' });
  function updatePresetDesc() {
    presetDesc.textContent = t(PRESETS[working.preset]?.desc || '');
  }

  function applyPreset(pid) {
    const before = { preset: working.preset, selection: { ...selection } };
    if (pid !== 'custom') selection = selectionForPreset(pid, profile, opts);
    working.preset = pid;
    haptic();
    syncSwitches();
    renderChips();
    updatePresetDesc();
    updateLive();
    persist();
    if (before.preset !== pid) {
      toast(t('Switched to {preset}', { preset: t(PRESETS[pid].label) }), {
        body: tn(Object.values(selection).filter(Boolean).length, '{n} detail on', '{n} details on'),
        undo: async () => {
          const cur = getCard(card.id);
          if (!cur) throw new Error(t('This card no longer exists.'));
          selection = before.selection;
          working = { ...cur, preset: before.preset };
          syncSwitches();
          renderChips();
          updatePresetDesc();
          updateLive();
          working = await saveCard({ ...working, shareFields: selection });
        },
      });
    }
  }

  // ---- switches ----
  const switchMap = new Map();
  function onToggle(key, value) {
    selection = { ...selection, [key]: value };
    const match = Object.keys(PRESETS).find((pid) => pid !== 'custom' && sameSelection(selectionForPreset(pid, profile, opts), selection));
    working.preset = match || 'custom';
    renderChips();
    updatePresetDesc();
    updateLive();
    persist();
  }
  function syncSwitches() {
    for (const [key, input] of switchMap) input.checked = Boolean(selection[key]);
  }

  const groups = GROUPS.map((g) => {
    const rows = items.filter((it) => it.group === g.id);
    if (!rows.length) return null;
    return h(
      'section',
      { class: 'section' },
      h('h2', { class: 'section-title' }, t(g.label)),
      h(
        'div',
        { class: 'group' },
        rows.map((it) => {
          const sw = Switch({ checked: Boolean(selection[it.key]), label: t('Share {field}', { field: it.label }), onChange: (v) => onToggle(it.key, v), testid: `toggle-${it.key}` });
          switchMap.set(it.key, sw.querySelector('input'));
          return h(
            'label',
            { class: 'row share-row' },
            h('span', { class: 'row-icon' }, icon(it.icon, { size: 18 })),
            h('span', { class: 'row-text' }, h('span', { class: 'row-title' }, it.label), h('span', { class: 'row-detail clamp-1' }, it.value)),
            sw,
          );
        }),
      ),
    );
  });

  const emptyState = !items.length
    ? h(
        'div',
        { class: 'empty' },
        h('div', { class: 'big-icon' }, icon('Contact', { size: 28 })),
        h('h2', null, t('Nothing to share yet')),
        h('p', null, t('Add your phone, email or profiles first.')),
        h('button', { type: 'button', class: 'btn primary', onclick: () => ctx.go('/profile') }, t('Edit my profile')),
      )
    : null;

  const el = h(
    'section',
    { class: 'share-screen' },
    TopBar({ title: t('Choose what to share'), onBack: () => { persist.flush(); ctx.back(); } }),
    h(
      'div',
      { class: 'scroll has-actionbar', 'data-scroll': '' },
      h(
        'div',
        { class: 'wrap' },
        h('p', { class: 'muted small lead' }, t('Sharing from your {card} card. Only switched-on details go into the QR.', { card: card.title })),
        chipRow,
        presetDesc,
        emptyState,
        groups,
        items.length
          ? h('div', { class: 'note', style: { marginTop: '22px' } }, icon('Info', { size: 18 }), h('span', null, t('New details you add to your profile start switched off here.')))
          : null,
      ),
    ),
    h('footer', { class: 'action-bar solid share-foot' }, qrBox, h('div', { class: 'share-foot-text' }, countLabel, sizeLabel), reviewBtn),
  );

  renderChips();
  updatePresetDesc();
  updateLive();

  return { el, title: t('Choose what to share'), destroy: () => persist.flush() };
}
