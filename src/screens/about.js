// About NEXO and its creator.
import { h } from '../utils/dom.js';
import { t } from '../utils/i18n.js';
import { icon } from '../components/Icon.js';
import { Row, TopBar } from '../components/Controls.js';
import { BrandMark, Wordmark } from '../components/Logo.js';
import { VERSION } from '../version.js';

const CREATOR = {
  name: 'Arunkumar Thamilarasu',
  photo: 'images/creator.webp',
  links: [
    { icon: 'youtube', title: 'YouTube', detail: 'Beyond The Obvious with Arun', href: 'https://www.youtube.com/@BeyondObviousArun' },
    { icon: 'instagram', title: 'Instagram', detail: '@beyondobviousarun', href: 'https://www.instagram.com/beyondobviousarun/' },
    { icon: 'github', title: 'GitHub', detail: 'tktarun03', href: 'https://github.com/tktarun03' },
  ],
};

export async function render(ctx) {
  const el = h(
    'section',
    { class: 'about-screen' },
    TopBar({ title: t('About'), onBack: () => ctx.back() }),
    h(
      'div',
      { class: 'scroll', 'data-scroll': '' },
      h(
        'div',
        { class: 'wrap' },
        h(
          'div',
          { class: 'about-brand' },
          BrandMark('lg'),
          Wordmark(),
          h('p', { class: 'tagline' }, t('Your identity. Your rules.')),
          h('p', { class: 'muted small' }, `${t('Version')} ${VERSION}`),
        ),
        h(
          'section',
          { class: 'section' },
          h('h2', { class: 'section-title' }, t('About NEXO')),
          h(
            'div',
            { class: 'group pad prose' },
            h('p', null, t('NEXO is a contact wallet that lives on your phone. Make a card for each side of you — work, friends, socials — and choose, detail by detail, what each QR gives away.')),
            h('p', null, t('There is no account and no server. Your details never leave the device unless you show or send them yourself.')),
          ),
        ),
        h(
          'section',
          { class: 'section' },
          h('h2', { class: 'section-title' }, t('Created out of passion')),
          h(
            'div',
            { class: 'group pad creator' },
            h('img', { class: 'creator-photo', src: CREATOR.photo, alt: CREATOR.name, width: '96', height: '96', loading: 'lazy' }),
            h('h3', null, CREATOR.name),
            h('p', { class: 'muted small' }, t('Created out of passion by {name}', { name: CREATOR.name })),
            h('p', null, t('I built NEXO because sharing a phone number shouldn’t mean handing over your whole life. Business cards get lost, and contact apps share too much. NEXO lets you decide — and keeps everything with you.')),
          ),
        ),
        h(
          'section',
          { class: 'section' },
          h('h2', { class: 'section-title' }, t('About me')),
          h(
            'div',
            { class: 'group pad prose' },
            h('p', null, t('I host “Beyond The Obvious with Arun” — conversations about AI, technology and ideas for social good, in Tamil and English.')),
            h('p', { class: 'muted' }, t('Learn. Explore. Share ideas.')),
          ),
        ),
        h(
          'section',
          { class: 'section' },
          h('h2', { class: 'section-title' }, t('Follow')),
          h('div', { class: 'group' }, CREATOR.links.map((l) => Row({ iconName: l.icon, title: l.title, detail: l.detail, href: l.href }))),
        ),
        h('p', { class: 'muted small center', style: { margin: '24px 0 8px' } }, icon('ShieldCheck', { size: 14 }), ' ', t('No tracking. No ads. No account.')),
      ),
    ),
  );
  return { el, title: t('About') };
}
