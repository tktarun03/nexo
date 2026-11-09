// Present the QR. Pure white surface, strong contrast, 4-module quiet zone,
// screen kept awake while open. Fields can be changed live from here.
import { h, setTrustedSVG, clear } from '../utils/dom.js';
import { t } from '../utils/i18n.js';
import { icon } from '../components/Icon.js';
import { Switch } from '../components/Controls.js';
import { openSheet } from '../components/BottomSheet.js';
import { toast } from '../components/Toast.js';
import { state, getCard, saveCard, getPhoto } from '../state.js';
import { listShareItems, resolveSelection, buildSharePayload, payloadRows, payloadIsEmpty, PRESETS, selectionForPreset } from '../services/ContactService.js';
import { encodeVCard, vcardFileName } from '../services/VCard.js';
import { toSVG, toPNGBlob, analyse } from '../services/QRService.js';
import { BrightnessService } from '../services/BrightnessService.js';
import { shareOrDownload, copyText, vcfFile, downloadBlob } from '../services/ShareService.js';
import { photoBase64ForVCard } from '../services/PhotoService.js';
import { getSettings, setSettings } from '../services/SettingsService.js';
import { sameSelection } from './share.js';

export async function render(ctx, { id }) {
  let card = getCard(id);
  if (!card) return ctx.notFound(t('This card no longer exists.'));
  const profile = state.profile;
  const opts = { hasPhoto: Boolean(profile.photoId) };
  let selection = resolveSelection(card, profile, opts);
  let data;
  let text;
  let info;

  const qrBox = h('div', { class: 'qr-code', role: 'img', 'data-testid': 'qr-code' });
  const nameEl = h('h1', { class: 'qr-name' });
  const presetEl = h('p', { class: 'qr-preset' });
  const chipsEl = h('ul', { class: 'qr-fields', 'aria-label': t('Included details') });
  const warnEl = h('div', { class: 'qr-warn' });
  const status = h('p', { class: 'qr-status' });

  async function update() {
    data = buildSharePayload(profile, selection);
    text = encodeVCard(data);
    const width = Math.min(window.innerWidth - 64, 340);
    info = analyse(text, width);
    nameEl.textContent = data.fullName || data.preferredName || card.displayName || card.title;
    presetEl.textContent = `${t(PRESETS[card.preset]?.label || 'Custom sharing')} · ${card.title}`;
    const rows = payloadRows(data).filter((r) => r.icon !== 'Image');
    chipsEl.replaceChildren(...rows.map((r) => h('li', null, icon(r.icon, { size: 14 }), h('span', null, r.label))));
    qrBox.setAttribute('aria-label', t('QR code with {n} details', { n: rows.length }));
    clear(warnEl);

    if (payloadIsEmpty(data)) {
      clear(qrBox).append(h('div', { class: 'qr-empty' }, icon('EyeOff', { size: 28 }), h('p', null, t('Nothing selected to share.'))));
      return;
    }
    if (!info.ok) {
      clear(qrBox).append(h('div', { class: 'qr-empty' }, icon('CircleAlert', { size: 28 }), h('p', null, t('Too much for one QR code.'))));
      warnEl.append(textFallback(t('Turn off a few details, or share the contact as text or a .vcf file instead.')));
      return;
    }
    setTrustedSVG(qrBox, await toSVG(text, info.ecl));
    qrBox.classList.remove('pop');
    void qrBox.offsetWidth;
    qrBox.classList.add('pop');
    if (info.level === 'dense') {
      warnEl.append(h('p', { class: 'qr-dense' }, icon('Info', { size: 15 }), t('Dense QR. Hold steady, or turn off a few details for faster scanning.')));
    } else if (info.level === 'too-dense') {
      warnEl.append(textFallback(t('This QR may be too dense for some cameras. Share as text or a .vcf file if it won’t scan.')));
    }
  }

  function textFallback(message) {
    return h(
      'div',
      { class: 'qr-fallback' },
      h('p', null, message),
      h('textarea', { class: 'input mono', readonly: true, rows: 5, 'aria-label': t('Contact as text'), value: text }),
      h('button', { type: 'button', class: 'btn sm secondary', onclick: onCopy }, icon('Copy', { size: 16 }), t('Copy text')),
    );
  }

  async function vcfText() {
    const photo = data.includePhoto ? getPhoto(profile.photoId) : null;
    let photoBase64 = '';
    if (photo) {
      try {
        photoBase64 = await photoBase64ForVCard(photo);
      } catch {
        photoBase64 = '';
      }
    }
    return encodeVCard(data, { photoBase64, fold: true });
  }

  async function onSaveQR() {
    try {
      const blob = await toPNGBlob(text, { ecl: info.ecl, size: 1024 });
      const name = `${vcardFileName(data).replace(/\.vcf$/, '')}-qr.png`;
      const file = new File([blob], name, { type: 'image/png' });
      const res = await shareOrDownload(file, { title: t('My contact QR') });
      if (res === 'shared') toast(t('QR shared'), { kind: 'good' });
      else if (res === 'downloaded') toast(t('QR image saved'), { kind: 'good', body: t('Check your downloads') });
    } catch {
      toast(t('Couldn’t save the QR'), { kind: 'bad', body: t('Try a screenshot instead.') });
    }
  }

  async function onShareContact() {
    try {
      const file = vcfFile(await vcfText(), vcardFileName(data));
      const res = await shareOrDownload(file, { title: nameEl.textContent, text: encodeVCard(data) });
      if (res === 'shared') toast(t('Contact shared'), { kind: 'good' });
      else if (res === 'downloaded') toast(t('Contact file saved'), { kind: 'good', body: vcardFileName(data) });
    } catch {
      toast(t('Couldn’t share the contact'), { kind: 'bad', body: t('Use Copy text instead.') });
    }
  }

  async function onDownloadVcf() {
    const file = vcfFile(await vcfText(), vcardFileName(data));
    downloadBlob(file, file.name);
    toast(t('Contact file saved'), { kind: 'good', body: file.name });
  }

  async function onCopy() {
    const ok = await copyText(text);
    toast(ok ? t('Copied as text') : t('Couldn’t copy'), { kind: ok ? 'good' : 'bad', body: ok ? t('Paste it into a message or note.') : t('Select the text and copy it by hand.') });
  }

  function openFields() {
    const items = listShareItems(profile, opts);
    const content = h(
      'div',
      { class: 'group' },
      items.map((it) =>
        h(
          'label',
          { class: 'row share-row' },
          h('span', { class: 'row-icon' }, icon(it.icon, { size: 18 })),
          h('span', { class: 'row-text' }, h('span', { class: 'row-title' }, it.label), h('span', { class: 'row-detail clamp-1' }, it.value)),
          Switch({
            checked: Boolean(selection[it.key]),
            label: t('Share {field}', { field: it.label }),
            testid: `qr-toggle-${it.key}`,
            onChange: async (v) => {
              selection = { ...selection, [it.key]: v };
              const match = Object.keys(PRESETS).find((pid) => pid !== 'custom' && sameSelection(selectionForPreset(pid, profile, opts), selection));
              card = await saveCard({ ...card, shareFields: selection, preset: match || 'custom' });
              update();
            },
          }),
        ),
      ),
    );
    openSheet({ title: t('Details in this QR'), content, size: 'auto' });
  }

  const caps = BrightnessService.capabilities();
  const el = h(
    'section',
    { class: 'qr-screen' },
    h(
      'header',
      { class: 'qr-head' },
      h('button', { type: 'button', class: 'icon-btn qr-btn', 'aria-label': t('Close'), onclick: () => ctx.closeTo('/home'), 'data-testid': 'qr-close' }, icon('X', { size: 22 })),
      h('span', { class: 'spacer' }),
      h('button', { type: 'button', class: 'chip qr-chip', onclick: openFields, 'data-testid': 'qr-fields' }, icon('SlidersHorizontal', { size: 16 }), t('Details')),
    ),
    h(
      'div',
      { class: 'qr-main', 'data-scroll': '' },
      h('div', { class: 'qr-frame' }, qrBox),
      nameEl,
      presetEl,
      chipsEl,
      warnEl,
      status,
      h(
        'div',
        { class: 'qr-actions' },
        h('button', { type: 'button', class: 'qr-action', onclick: onShareContact, 'data-testid': 'share-contact' }, icon('Share2'), h('span', null, t('Share'))),
        h('button', { type: 'button', class: 'qr-action', onclick: onSaveQR, 'data-testid': 'save-qr' }, icon('Download'), h('span', null, t('Save QR'))),
        h('button', { type: 'button', class: 'qr-action', onclick: onDownloadVcf, 'data-testid': 'download-vcf' }, icon('Contact'), h('span', null, '.vcf')),
        h('button', { type: 'button', class: 'qr-action', onclick: onCopy, 'data-testid': 'copy-text' }, icon('Copy'), h('span', null, t('Copy'))),
      ),
      h('p', { class: 'qr-privacy' }, icon('Lock', { size: 13 }), t('Made on this phone. Nothing is uploaded.')),
    ),
  );

  await update();

  return {
    el,
    title: t('QR code'),
    async mounted() {
      const st = await BrightnessService.enter();
      status.replaceChildren(
        icon(st.brightnessRaised ? 'Sun' : 'Smartphone', { size: 14 }),
        h(
          'span',
          null,
          st.brightnessRaised
            ? t('Brightness raised while the QR is open.')
            : st.wakeLock
              ? t('Screen will stay awake. Turn brightness up for faster scans.')
              : caps.wakeLock
                ? t('Turn your brightness up for faster scans.')
                : t('Turn your brightness up for faster scans. This browser can’t keep the screen awake.'),
        ),
      );
      if (!payloadIsEmpty(data)) setSettings({ shareCount: getSettings().shareCount + 1 });
    },
    destroy: () => BrightnessService.exit(),
  };
}
