// Full-screen photo cropper: drag to position, pinch or slide to zoom.
// Output is a 3:4 portrait JPEG (1080×1440) with a sampled tint colour.
import { h } from '../utils/dom.js';
import { t } from '../utils/i18n.js';
import { icon } from './Icon.js';
import { openSheet } from './BottomSheet.js';
import { loadImageFromFile, canvasToPhoto, CARD_PHOTO_W, CARD_PHOTO_H } from '../services/PhotoService.js';

const WORK_MAX = 2048;

/** Let the user pick a file, crop it, and resolve with a photo record (or null). */
export function pickAndCropPhoto() {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept: 'image/*', class: 'visually-hidden' });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return resolve(null);
      try {
        const img = await loadImageFromFile(file);
        resolve(await cropImage(img));
      } catch (err) {
        resolve({ error: err.message || t('Couldn’t open that photo.') });
      }
    });
    // iOS needs the input in the DOM for the picker to open reliably.
    document.body.append(input);
    input.click();
    // If the user cancels, some browsers fire no event; clean up on next focus.
    window.addEventListener('focus', () => setTimeout(() => {
      if (document.body.contains(input) && !input.files?.length) {
        input.remove();
        resolve(null);
      }
    }, 800), { once: true });
  });
}

export function cropImage(img) {
  return new Promise((resolve) => {
    const iw0 = img.width;
    const ih0 = img.height;
    const k = Math.min(1, WORK_MAX / Math.max(iw0, ih0));
    const work = document.createElement('canvas');
    work.width = Math.round(iw0 * k);
    work.height = Math.round(ih0 * k);
    work.getContext('2d').drawImage(img, 0, 0, work.width, work.height);
    img.close?.();
    work.className = 'crop-img';

    const frame = h('div', { class: 'crop-frame' }, work, h('div', { class: 'crop-grid', 'aria-hidden': 'true' }));
    const zoomInput = h('input', { type: 'range', min: '1', max: '4', step: '0.01', value: '1', 'aria-label': t('Zoom') });
    let result = null;
    let fw = 0;
    let fh = 0;
    let base = 1;
    let zoom = 1;
    let x = 0;
    let y = 0;

    const layout = () => {
      const r = frame.getBoundingClientRect();
      fw = r.width;
      fh = r.height;
      base = Math.max(fw / work.width, fh / work.height);
      apply(true);
    };
    const clamp = () => {
      const s = base * zoom;
      x = Math.min(0, Math.max(fw - work.width * s, x));
      y = Math.min(0, Math.max(fh - work.height * s, y));
    };
    const apply = (center = false) => {
      const s = base * zoom;
      if (center) {
        x = (fw - work.width * s) / 2;
        y = (fh - work.height * s) / 3; // slightly high: faces sit in the upper third
      }
      clamp();
      work.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`;
    };
    const setZoom = (z, cx = fw / 2, cy = fh / 2) => {
      const old = base * zoom;
      zoom = Math.min(4, Math.max(1, z));
      const s = base * zoom;
      x = cx - ((cx - x) * s) / old;
      y = cy - ((cy - y) * s) / old;
      zoomInput.value = String(zoom);
      apply();
    };
    zoomInput.addEventListener('input', () => setZoom(Number(zoomInput.value)));

    const pointers = new Map();
    let pinchStart = null;
    frame.addEventListener('pointerdown', (e) => {
      frame.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStart = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      }
    });
    frame.addEventListener('pointermove', (e) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, cur);
      if (pointers.size === 1) {
        x += cur.x - prev.x;
        y += cur.y - prev.y;
        apply();
      } else if (pointers.size === 2 && pinchStart) {
        const [a, b] = [...pointers.values()];
        const r = frame.getBoundingClientRect();
        setZoom(pinchStart.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinchStart.d), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      }
    });
    const up = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart = null;
    };
    frame.addEventListener('pointerup', up);
    frame.addEventListener('pointercancel', up);
    frame.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = frame.getBoundingClientRect();
      setZoom(zoom * (e.deltaY < 0 ? 1.08 : 0.93), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    const useBtn = h('button', { type: 'button', class: 'btn primary', 'data-testid': 'crop-use' }, icon('Check', { size: 18 }), t('Use photo'));
    const sheet = openSheet({
      title: t('Position your photo'),
      size: 'full',
      className: 'crop-sheet',
      content: h(
        'div',
        { class: 'cropper' },
        frame,
        h('div', { class: 'crop-zoom' }, icon('Minus', { size: 16 }), zoomInput, icon('Plus', { size: 16 })),
        h('p', { class: 'muted small center' }, t('Drag to move. Pinch or use the slider to zoom.')),
      ),
      footer: [h('button', { type: 'button', class: 'btn secondary', onclick: () => sheet.close() }, t('Cancel')), useBtn],
      onClose: () => {
        window.removeEventListener('resize', layout);
        resolve(result);
      },
    });

    useBtn.addEventListener('click', async () => {
      useBtn.disabled = true;
      const s = base * zoom;
      const out = document.createElement('canvas');
      out.width = CARD_PHOTO_W;
      out.height = CARD_PHOTO_H;
      const ctx = out.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(work, -x / s, -y / s, fw / s, fh / s, 0, 0, CARD_PHOTO_W, CARD_PHOTO_H);
      try {
        result = await canvasToPhoto(out);
      } catch (err) {
        result = { error: err.message };
      }
      sheet.close();
    });

    requestAnimationFrame(() => requestAnimationFrame(layout));
    window.addEventListener('resize', layout);
  });
}
