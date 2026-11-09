// Small shared controls: switch, text field, segmented control, list row.
import { h } from '../utils/dom.js';
import { icon } from './Icon.js';
import { uid } from '../utils/misc.js';
import { t } from '../utils/i18n.js';

export function Switch({ checked, onChange, label, testid }) {
  const input = h('input', {
    type: 'checkbox',
    role: 'switch',
    class: 'switch-input',
    checked,
    'aria-label': label,
    'data-testid': testid,
    onchange: (e) => onChange(e.target.checked),
  });
  return h('span', { class: 'switch' }, input, h('span', { class: 'switch-track', 'aria-hidden': 'true' }, h('span', { class: 'switch-thumb' })));
}

/** Labelled text input. Calls onInput(value) on every keystroke. */
export function Field({ label, value = '', type = 'text', placeholder = '', onInput, autocomplete, inputmode, name, multiline = false, maxlength = 300, hint, testid }) {
  const id = uid('f');
  const attrs = {
    id,
    name,
    value,
    placeholder,
    autocomplete: autocomplete || 'off',
    inputmode,
    maxlength,
    'data-testid': testid,
    oninput: (e) => onInput?.(e.target.value),
  };
  const control = multiline ? h('textarea', { ...attrs, rows: 3 }) : h('input', { ...attrs, type });
  if (multiline) control.value = value;
  return h(
    'label',
    { class: 'field', for: id },
    h('span', { class: 'field-label' }, label),
    control,
    hint ? h('span', { class: 'field-hint' }, hint) : null,
  );
}

export function Segmented({ options, value, onChange, label }) {
  const root = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label });
  const render = (current) => {
    root.replaceChildren(
      ...options.map((o) =>
        h(
          'button',
          {
            type: 'button',
            role: 'radio',
            'aria-checked': String(o.value === current),
            class: o.value === current ? 'on' : '',
            onclick: () => {
              render(o.value);
              onChange(o.value);
            },
          },
          o.icon ? icon(o.icon, { size: 16 }) : null,
          h('span', null, o.label),
        ),
      ),
    );
  };
  render(value);
  return root;
}

export function Row({ iconName, title, detail, onClick, trailing, danger, testid, href }) {
  const inner = [
    iconName ? h('span', { class: 'row-icon' }, icon(iconName, { size: 19 })) : null,
    h('span', { class: 'row-text' }, h('span', { class: 'row-title' }, title), detail ? h('span', { class: 'row-detail' }, detail) : null),
    trailing !== undefined ? trailing : onClick || href ? icon('ChevronRight', { size: 18, class: 'row-chev' }) : null,
  ];
  if (href) return h('a', { class: ['row', danger && 'danger'], href, target: '_blank', rel: 'noopener noreferrer', 'data-testid': testid }, inner);
  if (onClick) return h('button', { type: 'button', class: ['row', danger && 'danger'], onclick: onClick, 'data-testid': testid }, inner);
  return h('div', { class: 'row' }, inner);
}

export function TopBar({ title, onBack, actions = [], large = false }) {
  return h(
    'header',
    { class: ['topbar', large && 'large'] },
    onBack
      ? h('button', { type: 'button', class: 'icon-btn glass', 'aria-label': t('Back'), onclick: onBack, 'data-testid': 'back' }, icon('ChevronLeft', { size: 22 }))
      : h('span', { class: 'topbar-spacer' }),
    h('h1', { class: 'topbar-title' }, title),
    h('div', { class: 'topbar-actions' }, actions.length ? actions : h('span', { class: 'topbar-spacer' })),
  );
}
