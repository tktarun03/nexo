// Bottom notices (BasKar pattern). One at a time; a new one replaces the old.
//   toast(title)
//   toast(title, { kind: 'good' | 'bad', body })
//   toast(title, { body, undo: fn })
//   toast(title, { body, action: { label, fn } })
import { h, clear } from '../utils/dom.js';
import { icon } from './Icon.js';
import { t } from '../utils/i18n.js';

const DURATION = { plain: 4500, bad: 6000, action: 7000 };
let current = null;

export function toast(title, opts = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return null;
  dismiss(true);

  const hasButton = Boolean(opts.undo || opts.action);
  const ms = hasButton ? DURATION.action : opts.kind === 'bad' ? DURATION.bad : DURATION.plain;
  const kindIcon = opts.kind === 'good' ? icon('CircleCheck', { size: 20 }) : opts.kind === 'bad' ? icon('CircleAlert', { size: 20 }) : null;

  let button = null;
  if (opts.undo) {
    button = h('button', { type: 'button', class: 'toast-btn', onclick: () => run(opts.undo) }, t('Undo'));
  } else if (opts.action) {
    button = h('button', { type: 'button', class: 'toast-btn', onclick: () => run(opts.action.fn) }, opts.action.label);
  }

  const el = h(
    'div',
    {
      class: ['toast', opts.kind && `toast-${opts.kind}`],
      role: opts.kind === 'bad' ? 'alert' : 'status',
      'aria-live': opts.kind === 'bad' ? 'assertive' : 'polite',
      'data-testid': 'toast',
    },
    kindIcon && h('span', { class: 'toast-icon' }, kindIcon),
    h('div', { class: 'toast-text' }, h('strong', null, title), opts.body ? h('span', null, opts.body) : null),
    button,
    h('button', { type: 'button', class: 'toast-x', 'aria-label': t('Dismiss'), onclick: () => dismiss() }, icon('X', { size: 18 })),
  );

  const state = { el, timer: null, remaining: ms, started: 0 };
  const start = () => {
    clearTimeout(state.timer);
    state.started = Date.now();
    state.timer = setTimeout(() => dismiss(), state.remaining);
  };
  const pause = () => {
    clearTimeout(state.timer);
    state.remaining = Math.max(800, state.remaining - (Date.now() - state.started));
  };
  el.addEventListener('pointerenter', pause);
  el.addEventListener('pointerleave', start);
  el.addEventListener('focusin', pause);
  el.addEventListener('focusout', start);

  async function run(fn) {
    dismiss();
    try {
      await fn();
    } catch (err) {
      toast(t('Couldn’t undo'), { kind: 'bad', body: err?.message || t('Please try again.') });
    }
  }

  clear(root).append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  current = state;
  start();
  return el;
}

export function dismiss(immediate = false) {
  if (!current) return;
  const { el, timer } = current;
  clearTimeout(timer);
  current = null;
  if (immediate) {
    el.remove();
    return;
  }
  el.classList.remove('show');
  el.classList.add('hide');
  setTimeout(() => el.remove(), 240);
}
