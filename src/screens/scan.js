// Scan someone's QR. Decoding happens on the device: the native BarcodeDetector
// where available, otherwise the bundled jsQR. Scanned content is untrusted:
// it is parsed defensively, shown as plain text, and only saved when the user taps Save.
import { h, haptic, clear } from '../utils/dom.js';
import { t } from '../utils/i18n.js';
import { icon } from '../components/Icon.js';
import { openSheet, confirmSheet } from '../components/BottomSheet.js';
import { toast } from '../components/Toast.js';
import { parseScanned, encodeVCard, vcardFileName } from '../services/VCard.js';
import { payloadRows } from '../services/ContactService.js';
import { decodeImageData } from '../services/QRService.js';
import { loadImageFromFile } from '../services/PhotoService.js';
import { vcfFile, downloadBlob, shareOrDownload, copyText } from '../services/ShareService.js';
import { previewList } from './review.js';
import { initials } from '../utils/misc.js';

async function nativeDetector() {
  try {
    if (!('BarcodeDetector' in window)) return null;
    const formats = (await window.BarcodeDetector.getSupportedFormats?.()) || [];
    if (!formats.includes('qr_code')) return null;
    return new window.BarcodeDetector({ formats: ['qr_code'] });
  } catch {
    return null;
  }
}

export async function render(ctx) {
  const video = h('video', { class: 'scan-video', playsinline: true, muted: true, autoplay: true, 'aria-hidden': 'true' });
  video.muted = true;
  const stateBox = h('div', { class: 'scan-state', 'aria-live': 'polite' });
  const torchBtn = h('button', { type: 'button', class: 'icon-btn scan-btn', hidden: true, 'aria-label': t('Torch'), 'aria-pressed': 'false' }, icon('Flashlight'));
  const fileInput = h('input', { type: 'file', accept: 'image/*', class: 'visually-hidden', 'data-testid': 'scan-file' });

  let stream = null;
  let detector = null;
  let running = false;
  let paused = false;
  let rafId = 0;
  let lastScan = 0;
  let destroyed = false;
  const work = document.createElement('canvas');
  const wctx = work.getContext('2d', { willReadFrequently: true });

  function showState(kind, title, body, actions = []) {
    clear(stateBox).append(
      h(
        'div',
        { class: ['scan-msg', kind] },
        h('div', { class: 'big-icon' }, icon(kind === 'error' ? 'CircleAlert' : kind === 'busy' ? 'Camera' : 'ScanQrCode', { size: 26 })),
        h('h2', null, title),
        body ? h('p', null, body) : null,
        actions.length ? h('div', { class: 'hstack wrap-row' }, actions) : null,
      ),
    );
    stateBox.hidden = false;
  }
  const hideState = () => {
    stateBox.hidden = true;
    clear(stateBox);
  };
  const fileButton = (label = t('Scan from a photo')) =>
    h('button', { type: 'button', class: 'btn white', onclick: () => fileInput.click() }, icon('Image', { size: 18 }), label);
  const pasteButton = () => h('button', { type: 'button', class: 'btn secondary', onclick: openPaste }, icon('FileText', { size: 18 }), t('Paste text'));

  async function start() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      showState(
        'error',
        t('Camera not available here'),
        window.isSecureContext
          ? t('This browser can’t use the camera. You can still scan a QR from a photo.')
          : t('The camera only works over HTTPS or on localhost. You can still scan a QR from a photo.'),
        [fileButton(), pasteButton()],
      );
      return;
    }
    showState('busy', t('Starting camera…'), t('Allow camera access when asked. Nothing is recorded or uploaded.'));
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (destroyed) return stop();
      video.srcObject = stream;
      await video.play().catch(() => {});
      detector = await nativeDetector();
      setupTorch();
      hideState();
      running = true;
      loop();
    } catch (err) {
      const name = err?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        showState('error', t('Camera access is off'), t('Allow camera access for this site in your browser settings, then try again. Or scan a QR from a photo.'), [
          h('button', { type: 'button', class: 'btn secondary', onclick: start }, icon('RotateCcw', { size: 18 }), t('Try again')),
          fileButton(),
        ]);
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        showState('error', t('No camera found'), t('Scan a QR from a photo instead.'), [fileButton(), pasteButton()]);
      } else if (name === 'NotReadableError') {
        showState('error', t('Camera is busy'), t('Another app may be using it. Close it and try again.'), [
          h('button', { type: 'button', class: 'btn secondary', onclick: start }, t('Try again')),
          fileButton(),
        ]);
      } else {
        showState('error', t('Couldn’t start the camera'), t('Scan a QR from a photo instead.'), [fileButton(), pasteButton()]);
      }
    }
  }

  function setupTorch() {
    const track = stream?.getVideoTracks?.()[0];
    const caps = track?.getCapabilities?.();
    if (!caps || !caps.torch) return;
    let on = false;
    torchBtn.hidden = false;
    torchBtn.onclick = async () => {
      on = !on;
      try {
        await track.applyConstraints({ advanced: [{ torch: on }] });
        torchBtn.setAttribute('aria-pressed', String(on));
        torchBtn.classList.toggle('on', on);
      } catch {
        torchBtn.hidden = true;
      }
    };
  }

  async function loop() {
    if (!running || destroyed) return;
    rafId = requestAnimationFrame(loop);
    if (paused || video.readyState < 2) return;
    const now = performance.now();
    if (now - lastScan < (detector ? 150 : 220)) return;
    lastScan = now;
    try {
      let value = null;
      if (detector) {
        const codes = await detector.detect(video);
        value = codes[0]?.rawValue ?? null;
      } else {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (!vw || !vh) return;
        const side = Math.min(vw, vh);
        const size = Math.min(720, side);
        work.width = size;
        work.height = size;
        wctx.drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, size, size);
        value = await decodeImageData(wctx.getImageData(0, 0, size, size));
      }
      if (value && !paused) handleResult(value);
    } catch {
      /* transient decode errors are normal while the camera focuses */
    }
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
    stream?.getTracks().forEach((tr) => tr.stop());
    stream = null;
    video.srcObject = null;
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const img = await loadImageFromFile(file);
      const max = 1600;
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      const cx = c.getContext('2d', { willReadFrequently: true });
      cx.drawImage(img, 0, 0, c.width, c.height);
      let value = null;
      const det = await nativeDetector();
      if (det) value = (await det.detect(c).catch(() => []))[0]?.rawValue ?? null;
      if (!value) value = await decodeImageData(cx.getImageData(0, 0, c.width, c.height));
      if (value) handleResult(value);
      else toast(t('No QR code found'), { kind: 'bad', body: t('Try a sharper, closer photo.') });
    } catch (err) {
      toast(t('Couldn’t read that photo'), { kind: 'bad', body: err?.message });
    }
  });

  function openPaste() {
    const ta = h('textarea', { class: 'input mono', rows: 8, placeholder: 'BEGIN:VCARD…', 'aria-label': t('Contact text'), maxlength: 8000 });
    const sheet = openSheet({
      title: t('Paste contact text'),
      content: h('div', { class: 'stack' }, h('p', { class: 'muted small' }, t('Paste a vCard or MeCard someone sent you as text.')), ta),
      footer: [
        h('button', { type: 'button', class: 'btn secondary', onclick: () => sheet.close() }, t('Cancel')),
        h('button', { type: 'button', class: 'btn primary', onclick: () => {
          const v = ta.value;
          sheet.close();
          setTimeout(() => handleResult(v), 300);
        } }, t('Read')),
      ],
    });
  }

  function handleResult(raw) {
    paused = true;
    haptic(20);
    const res = parseScanned(raw);
    if (res.kind === 'empty') {
      paused = false;
      return;
    }
    showResult(res);
  }

  function showResult(res) {
    let content;
    let footer;
    let sheet;
    if (res.kind === 'contact') {
      const c = res.contact;
      const rows = payloadRows(c);
      const name = c.fullName || c.preferredName || t('Unnamed contact');
      const sub = [c.jobTitle, c.company].filter(Boolean).join(' · ');
      content = h(
        'div',
        { class: 'stack', 'data-testid': 'scan-result' },
        h(
          'div',
          { class: 'received-head' },
          h('div', { class: 'received-avatar', 'aria-hidden': 'true' }, initials(name)),
          h('div', null, h('h2', { class: 'received-name' }, name), sub ? h('p', { class: 'muted' }, sub) : null),
        ),
        h('p', { class: 'muted small' }, t('Review before saving. Nothing has been saved yet.')),
        h('div', { class: 'group' }, previewList(rows)),
      );
      const fileName = vcardFileName(c);
      footer = [
        h('button', {
          type: 'button',
          class: 'btn secondary',
          onclick: async () => {
            const res2 = await shareOrDownload(vcfFile(encodeVCard(c, { fold: true }), fileName), { title: name, text: encodeVCard(c) });
            if (res2 !== 'cancelled') toast(t('Contact shared'), { kind: 'good' });
          },
        }, icon('Share2', { size: 18 }), t('Share')),
        h('button', {
          type: 'button',
          class: 'btn primary',
          'data-testid': 'save-contact',
          onclick: () => {
            downloadBlob(vcfFile(encodeVCard(c, { fold: true }), fileName), fileName);
            toast(t('Contact file ready'), { kind: 'good', body: t('Open {file} to add it to Contacts', { file: fileName }), action: { label: t('Done'), fn: () => ctx.closeTo('/home') } });
            sheet.close();
          },
        }, icon('Contact', { size: 18 }), t('Save contact')),
      ];
    } else if (res.kind === 'url') {
      const host = (() => {
        try {
          return new URL(res.url).host;
        } catch {
          return res.url;
        }
      })();
      content = h(
        'div',
        { class: 'stack', 'data-testid': 'scan-result' },
        h('p', null, t('This QR contains a link, not a contact.')),
        h('p', { class: 'mono break' }, res.url),
        h('div', { class: 'note warn' }, icon('Shield', { size: 18 }), h('span', null, t('Only open links you trust. It goes to {host}.', { host }))),
      );
      footer = [
        h('button', { type: 'button', class: 'btn secondary', onclick: async () => toast((await copyText(res.url)) ? t('Link copied') : t('Couldn’t copy'), {}) }, icon('Copy', { size: 18 }), t('Copy')),
        h('button', {
          type: 'button',
          class: 'btn primary',
          onclick: async () => {
            const ok = await confirmSheet({ title: t('Open this link?'), message: res.url, confirmLabel: t('Open') });
            if (ok) window.open(res.url, '_blank', 'noopener,noreferrer');
          },
        }, icon('ExternalLink', { size: 18 }), t('Open')),
      ];
    } else {
      content = h(
        'div',
        { class: 'stack', 'data-testid': 'scan-result' },
        h('p', null, t('This QR contains text, not a contact.')),
        h('pre', { class: 'mono break scanned-text' }, res.text),
      );
      footer = [h('button', { type: 'button', class: 'btn primary', onclick: async () => toast((await copyText(res.text)) ? t('Text copied') : t('Couldn’t copy'), {}) }, icon('Copy', { size: 18 }), t('Copy text'))];
    }
    sheet = openSheet({
      title: res.kind === 'contact' ? t('Scanned contact') : t('Scanned QR'),
      content,
      footer,
      onClose: () => {
        setTimeout(() => (paused = false), 600);
      },
    });
  }

  const el = h(
    'section',
    { class: 'scan-screen' },
    video,
    h('div', { class: 'scan-frame', 'aria-hidden': 'true' }, h('span', { class: 'scan-line' })),
    h(
      'header',
      { class: 'scan-head' },
      h('button', { type: 'button', class: 'icon-btn scan-btn', 'aria-label': t('Close'), onclick: () => ctx.back(), 'data-testid': 'scan-close' }, icon('X', { size: 22 })),
      h('h1', null, t('Scan a QR')),
      h('span', { class: 'topbar-spacer' }, torchBtn),
    ),
    stateBox,
    h(
      'footer',
      { class: 'scan-foot' },
      h('p', null, t('Point at a NEXO or any contact QR code.')),
      h('div', { class: 'hstack' }, fileButton(t('From photo')), pasteButton()),
      fileInput,
    ),
  );

  const onVis = () => {
    if (document.visibilityState === 'hidden') stop();
    else if (!destroyed && !stream) start();
  };

  return {
    el,
    title: t('Scan'),
    mounted() {
      document.addEventListener('visibilitychange', onVis);
      start();
    },
    destroy() {
      destroyed = true;
      document.removeEventListener('visibilitychange', onVis);
      stop();
    },
  };
}
