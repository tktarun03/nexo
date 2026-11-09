// Bottom sheets with natural motion, drag-to-dismiss, Back-button support,
// Escape to close and focus return.
import { h, prefersReducedMotion } from '../utils/dom.js';
import { icon } from './Icon.js';
import { t } from '../utils/i18n.js';
import { pushSheet, popSheet } from '../router.js';

export function openSheet({ title, content, footer, onClose, size = 'auto', label, className } = {}) {
  const host = document.getElementById('sheets');
  const opener = document.activeElement;
  const titleId = `sheet-title-${Math.random().toString(36).slice(2, 8)}`;

  const body = h('div', { class: 'sheet-body', 'data-scroll': '' }, content);
  const panel = h(
    'div',
    {
      class: ['sheet', `sheet-${size}`, className],
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': title ? titleId : null,
      'aria-label': title ? null : label || t('Panel'),
    },
    h('div', { class: 'sheet-grab', 'aria-hidden': 'true' }, h('span')),
    title
      ? h(
          'header',
          { class: 'sheet-head' },
          h('h2', { id: titleId }, title),
          h('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': t('Close'), onclick: () => close() }, icon('X')),
        )
      : null,
    body,
    footer ? h('footer', { class: 'sheet-foot' }, footer) : null,
  );
  const backdrop = h('div', { class: 'sheet-backdrop', onclick: () => close() });
  const wrap = h('div', { class: 'sheet-wrap' }, backdrop, panel);
  host.append(wrap);
  document.documentElement.classList.add('sheet-open');

  let closed = false;
  const entry = {
    close(fromHistory = false, { silent = false } = {}) {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey);
      vv?.removeEventListener('resize', onViewport);
      wrap.classList.remove('open');
      wrap.classList.add('closing');
      const done = () => {
        wrap.remove();
        if (!document.querySelector('.sheet-wrap')) document.documentElement.classList.remove('sheet-open');
      };
      if (prefersReducedMotion() || silent) done();
      else setTimeout(done, 260);
      if (!silent && opener && document.contains(opener)) opener.focus?.({ preventScroll: true });
      onClose?.();
    },
  };

  function close() {
    if (closed) return;
    popSheet(entry);
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKey);

  // Keep inputs above the iOS keyboard.
  const vv = window.visualViewport;
  function onViewport() {
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    panel.style.setProperty('--kb', `${kb}px`);
  }
  vv?.addEventListener('resize', onViewport);

  // Drag to dismiss from the grabber/header.
  let startY = null;
  let dy = 0;
  const dragZone = [panel.querySelector('.sheet-grab'), panel.querySelector('.sheet-head')].filter(Boolean);
  for (const zone of dragZone) {
    zone.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      startY = e.clientY;
      dy = 0;
      zone.setPointerCapture(e.pointerId);
      panel.style.transition = 'none';
    });
    zone.addEventListener('pointermove', (e) => {
      if (startY === null) return;
      dy = Math.max(0, e.clientY - startY);
      panel.style.transform = `translate3d(0, ${dy}px, 0)`;
    });
    const end = () => {
      if (startY === null) return;
      startY = null;
      panel.style.transition = '';
      panel.style.transform = '';
      if (dy > 110) close();
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }

  pushSheet(entry);
  requestAnimationFrame(() => {
    wrap.classList.add('open');
    const first = panel.querySelector('[autofocus]') || panel.querySelector('.sheet-head button');
    first?.focus({ preventScroll: true });
  });

  return { el: panel, body, close, entry };
}

/** Confirmation sheet. Resolves true/false. */
export function confirmSheet({ title, message, confirmLabel = t('Confirm'), danger = false, detail }) {
  return new Promise((resolve) => {
    let result = false;
    const sheet = openSheet({
      title,
      content: h('div', { class: 'confirm' }, h('p', null, message), detail || null),
      footer: [
        h('button', { type: 'button', class: 'btn secondary', onclick: () => sheet.close() }, t('Cancel')),
        h(
          'button',
          {
            type: 'button',
            class: ['btn', danger ? 'danger' : 'primary'],
            'data-testid': 'confirm-yes',
            onclick: () => {
              result = true;
              sheet.close();
            },
          },
          confirmLabel,
        ),
      ],
      onClose: () => resolve(result),
    });
  });
}
