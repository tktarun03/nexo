// Welcome + short, skippable intro tour.
import { h } from '../utils/dom.js';
import { t } from '../utils/i18n.js';
import { icon } from '../components/Icon.js';
import { BrandMark, Wordmark } from '../components/Logo.js';
import { IdentityCard } from '../components/IdentityCard.js';
import { buildDemo } from '../data/demo.js';
import { migrateCard } from '../services/ContactService.js';
import { isIosSafariTab } from '../services/PwaService.js';

export async function render(ctx) {
  const demo = buildDemo();
  const fan = h(
    'div',
    { class: 'fan', 'aria-hidden': 'true' },
    demo.cards.map((c, i) => h('div', { class: `fan-card fan-${i}` }, IdentityCard(migrateCard(c, i), {}))),
  );
  const toggles = h(
    'div',
    { class: 'mini-toggles', 'aria-hidden': 'true' },
    [
      [t('Full name'), true],
      [t('Mobile'), true],
      [t('Work email'), true],
      [t('Home address'), false],
      [t('Birthday'), false],
    ].map(([label, on]) => h('div', { class: 'mini-toggle' }, h('span', null, label), h('span', { class: ['mini-switch', on && 'on'] }))),
  );
  const qrArt = h('div', { class: 'qr-art', 'aria-hidden': 'true' }, icon('QrCode', { size: 96, stroke: 1.2 }), h('span', { class: 'qr-art-glow' }));

  const slides = [
    { art: fan, title: t('Your identity. Your rules.'), body: t('Beautiful contact cards that live only on your phone. No account, no cloud.') },
    { art: toggles, title: t('Share only what you choose'), body: t('Switch each detail on or off. Your address and birthday stay private unless you say so.') },
    { art: qrArt, title: t('Show a QR. Done.'), body: t('Any iPhone or Android camera can scan it and save you as a contact.') },
  ];

  const track = h(
    'div',
    { class: 'tour', 'data-testid': 'tour' },
    slides.map((s, i) =>
      h('section', { class: 'tour-slide', 'aria-roledescription': 'slide', 'aria-label': t('{n} of {total}', { n: i + 1, total: slides.length }) }, h('div', { class: 'tour-art' }, s.art), h('h1', null, s.title), h('p', null, s.body)),
    ),
  );
  const dots = h('div', { class: 'tour-dots', 'aria-hidden': 'true' }, slides.map((_, i) => h('span', { class: i === 0 ? 'on' : '' })));
  let index = 0;
  const nextBtn = h('button', { type: 'button', class: 'btn primary block', 'data-testid': 'tour-next' }, t('Next'));
  const update = () => {
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i === index));
    const last = index === slides.length - 1;
    nextBtn.textContent = last ? t('Create my card') : t('Next');
    skipBtn.hidden = last;
  };
  track.addEventListener('scroll', () => {
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== index) {
      index = Math.max(0, Math.min(slides.length - 1, i));
      update();
    }
  }, { passive: true });
  nextBtn.addEventListener('click', () => {
    if (index === slides.length - 1) ctx.go('/onboarding');
    else track.scrollTo({ left: (index + 1) * track.clientWidth, behavior: 'smooth' });
  });
  const skipBtn = h('button', { type: 'button', class: 'link-btn', onclick: () => ctx.go('/onboarding'), 'data-testid': 'tour-skip' }, t('Skip'));

  const tip = isIosSafariTab()
    ? h('div', { class: 'note accent install-tip' }, icon('Smartphone', { size: 18 }), h('span', null, t('Tip: add NEXO to your Home Screen first (Share → Add to Home Screen). iPhone keeps Home Screen app data separate from Safari.')))
    : null;

  const el = h(
    'section',
    { class: 'welcome' },
    h('header', { class: 'welcome-head' }, BrandMark('sm'), Wordmark(), h('span', { class: 'spacer' }), skipBtn),
    track,
    dots,
    h(
      'footer',
      { class: 'welcome-foot' },
      tip,
      nextBtn,
      h('button', { type: 'button', class: 'btn ghost block', onclick: () => ctx.startDemo(), 'data-testid': 'start-demo' }, icon('Sparkles', { size: 18 }), t('Explore the demo first')),
      h('p', { class: 'muted small center' }, t('Private by design: nothing leaves your device unless you share it.')),
    ),
  );
  update();
  return { el, title: t('Welcome') };
}
