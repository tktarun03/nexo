// First launch: Name → Photo → Details → First card → Review → Home.
// One topic per screen, a progress bar, and values kept when going back.
import { h, clear } from '../utils/dom.js';
import { t } from '../utils/i18n.js';
import { icon } from '../components/Icon.js';
import { Field } from '../components/Controls.js';
import { IdentityCard } from '../components/IdentityCard.js';
import { toast } from '../components/Toast.js';
import { pickAndCropPhoto } from '../components/PhotoCropper.js';
import { saveProfile, savePhoto, saveCard, newCard, load } from '../state.js';
import { emptyProfile, migrateCard, CARD_TYPES, buildSharePayload, selectionForPreset, payloadRows } from '../services/ContactService.js';
import { photoURL } from '../services/PhotoService.js';
import { setSettings } from '../services/SettingsService.js';
import { requestPersistence } from '../services/StorageService.js';
import { uid } from '../utils/misc.js';

const STEPS = ['name', 'photo', 'details', 'card', 'review'];

// Draft survives going back and forth between steps (memory only until Finish).
let draft = null;
function freshDraft() {
  const p = emptyProfile();
  p.phones = [{ id: uid('p'), label: 'Mobile', value: '' }];
  p.emails = [{ id: uid('e'), label: 'Personal', value: '' }];
  return { step: 0, profile: p, photo: null, cardType: 'personal', subtitle: '' };
}

export async function render(ctx) {
  if (!draft) draft = freshDraft();
  const body = h('div', { class: 'onb-body', 'data-scroll': '' });
  const bar = h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '1', 'aria-valuemax': String(STEPS.length) }, h('span'));
  const backBtn = h('button', { type: 'button', class: 'icon-btn glass', 'aria-label': t('Back'), 'data-testid': 'onb-back' }, icon('ChevronLeft', { size: 22 }));
  const nextBtn = h('button', { type: 'button', class: 'btn primary block', 'data-testid': 'onb-next' });
  const skipBtn = h('button', { type: 'button', class: 'link-btn', 'data-testid': 'onb-skip' }, t('Skip'));
  const p = draft.profile;

  function go(step) {
    draft.step = Math.max(0, Math.min(STEPS.length - 1, step));
    draw();
    body.scrollTop = 0;
  }
  backBtn.addEventListener('click', () => (draft.step === 0 ? ctx.back('/welcome') : go(draft.step - 1)));
  skipBtn.addEventListener('click', () => go(draft.step + 1));

  function draw() {
    const name = STEPS[draft.step];
    bar.firstChild.style.transform = `scaleX(${(draft.step + 1) / STEPS.length})`;
    bar.setAttribute('aria-valuenow', String(draft.step + 1));
    bar.setAttribute('aria-label', t('Step {n} of {total}', { n: draft.step + 1, total: STEPS.length }));
    skipBtn.hidden = !['photo', 'details'].includes(name);
    nextBtn.onclick = null;
    nextBtn.disabled = false;
    const view = VIEWS[name]();
    clear(body).append(h('div', { class: 'onb-step fade-up' }, view));
  }

  const VIEWS = {
    name() {
      nextBtn.textContent = t('Continue');
      const validate = () => (nextBtn.disabled = !p.fullName.trim());
      nextBtn.onclick = () => go(1);
      const full = Field({ label: t('Full name'), value: p.fullName, autocomplete: 'name', testid: 'onb-full-name', onInput: (v) => { p.fullName = v; validate(); } });
      full.querySelector('input').setAttribute('autofocus', '');
      validate();
      setTimeout(() => full.querySelector('input').focus({ preventScroll: true }), 350);
      return [
        h('h1', { class: 'onb-title' }, t('What’s your name?')),
        h('p', { class: 'onb-sub' }, t('This stays on your phone. You choose later what to share.')),
        h('div', { class: 'stack' }, full, Field({ label: t('Preferred name (optional)'), value: p.preferredName, autocomplete: 'nickname', onInput: (v) => (p.preferredName = v) })),
      ];
    },
    photo() {
      nextBtn.textContent = draft.photo ? t('Continue') : t('Continue without photo');
      nextBtn.onclick = () => go(2);
      const pick = async () => {
        const res = await pickAndCropPhoto();
        if (!res) return;
        if (res.error) return toast(t('Couldn’t use that photo'), { kind: 'bad', body: res.error });
        draft.photo = res;
        draw();
      };
      return [
        h('h1', { class: 'onb-title' }, t('Add a photo')),
        h('p', { class: 'onb-sub' }, t('A portrait makes your card feel like you. It’s never put in the QR.')),
        h(
          'button',
          { type: 'button', class: 'onb-photo', onclick: pick, 'data-testid': 'onb-photo' },
          draft.photo ? h('img', { src: photoURL(draft.photo), alt: t('Your photo') }) : h('span', { class: 'onb-photo-empty' }, icon('ImagePlus', { size: 34 }), h('span', null, t('Choose photo'))),
        ),
        draft.photo ? h('button', { type: 'button', class: 'btn sm secondary', style: { alignSelf: 'center' }, onclick: pick }, t('Choose another')) : null,
      ];
    },
    details() {
      nextBtn.textContent = t('Continue');
      nextBtn.onclick = () => go(3);
      return [
        h('h1', { class: 'onb-title' }, t('How can people reach you?')),
        h('p', { class: 'onb-sub' }, t('Add the basics now. You can add more numbers, emails and profiles later.')),
        h(
          'div',
          { class: 'stack' },
          Field({ label: t('Mobile'), type: 'tel', inputmode: 'tel', autocomplete: 'tel', value: p.phones[0].value, placeholder: '+974 5555 0000', testid: 'onb-phone', onInput: (v) => (p.phones[0].value = v) }),
          Field({ label: t('Email'), type: 'email', inputmode: 'email', autocomplete: 'email', value: p.emails[0].value, placeholder: 'you@example.com', testid: 'onb-email', onInput: (v) => (p.emails[0].value = v) }),
          Field({ label: t('Job title (optional)'), autocomplete: 'organization-title', value: p.jobTitle, onInput: (v) => (p.jobTitle = v) }),
          Field({ label: t('Company (optional)'), autocomplete: 'organization', value: p.company, onInput: (v) => (p.company = v) }),
        ),
      ];
    },
    card() {
      nextBtn.textContent = t('Continue');
      nextBtn.onclick = () => go(4);
      const preview = h('div', { class: 'card-preview small' });
      const draw2 = () => {
        const c = previewCard();
        clear(preview).append(IdentityCard(c, { photo: draft.photo }));
      };
      const chips = h('div', { class: 'chips' });
      const drawChips = () =>
        chips.replaceChildren(
          ...Object.entries(CARD_TYPES).filter(([k]) => k !== 'custom').map(([k, v]) =>
            h('button', {
              type: 'button',
              class: ['chip', draft.cardType === k && 'on'],
              'aria-pressed': String(draft.cardType === k),
              'data-testid': `onb-type-${k}`,
              onclick: () => {
                draft.cardType = k;
                drawChips();
                draw2();
              },
            }, icon(v.icon, { size: 15 }), t(v.label)),
          ),
        );
      drawChips();
      draw2();
      return [
        h('h1', { class: 'onb-title' }, t('Create your first card')),
        h('p', { class: 'onb-sub' }, t('Pick a type. Each card remembers what it shares. You can add more cards later.')),
        chips,
        preview,
        Field({ label: t('Subtitle (optional)'), value: draft.subtitle, placeholder: t('e.g. Designer · Lumen Studio'), maxlength: 80, onInput: (v) => { draft.subtitle = v; draw2(); } }),
      ];
    },
    review() {
      nextBtn.textContent = t('Finish');
      nextBtn.onclick = finish;
      const c = previewCard();
      const rows = payloadRows(buildSharePayload(p, selectionForPreset(c.preset, p, { hasPhoto: Boolean(draft.photo) })));
      return [
        h('h1', { class: 'onb-title' }, t('All set')),
        h('p', { class: 'onb-sub' }, t('Your {type} card will share these by default. You can change any of them before showing the QR.', { type: t(CARD_TYPES[c.type].label) })),
        h('div', { class: 'group' }, h('ul', { class: 'preview-list' }, rows.map((r) => h('li', null, h('span', { class: 'row-icon' }, icon(r.icon, { size: 18 })), h('span', { class: 'row-text' }, h('span', { class: 'row-detail' }, r.label), h('span', { class: 'row-title' }, r.value)))))),
        h('div', { class: 'note' }, icon('HardDrive', { size: 18 }), h('span', null, t('Everything is saved in this browser only. Make a backup file from Settings now and then — clearing browser data erases it.'))),
      ];
    },
  };

  function previewCard() {
    const type = draft.cardType;
    return migrateCard({
      id: 'preview',
      type,
      title: t(CARD_TYPES[type].label),
      displayName: type === 'personal' ? p.preferredName || p.fullName : p.fullName,
      subtitle: draft.subtitle || (type === 'professional' || type === 'business' ? [p.jobTitle, p.company].filter(Boolean).join(' · ') : ''),
      preset: CARD_TYPES[type].preset,
      scene: { personal: 'dusk', professional: 'sky', social: 'lake', business: 'forest' }[type] || 'sky',
    });
  }

  async function finish() {
    nextBtn.disabled = true;
    try {
      p.phones = p.phones.filter((x) => x.value.trim());
      p.emails = p.emails.filter((x) => x.value.trim());
      if (draft.photo) {
        await savePhoto(draft.photo);
        p.photoId = draft.photo.id;
      }
      await saveProfile(p);
      const pc = previewCard();
      const card = newCard(pc.type, { title: pc.title, displayName: pc.displayName, subtitle: pc.subtitle, scene: pc.scene, preset: pc.preset });
      const saved = await saveCard(card);
      setSettings({ selectedCardId: saved.id });
      requestPersistence();
      draft = null;
      await load();
      ctx.go('/home', { replace: true });
      toast(t('Your card is ready'), { kind: 'good', body: t('Tap it to choose what to share.') });
    } catch {
      nextBtn.disabled = false;
      toast(t('Couldn’t save'), { kind: 'bad', body: t('Your browser blocked storage. Private browsing can do this.') });
    }
  }

  const el = h(
    'section',
    { class: 'onboarding' },
    h('header', { class: 'onb-head' }, backBtn, bar, skipBtn),
    body,
    h('footer', { class: 'onb-foot' }, nextBtn),
  );
  draw();
  return { el, title: t('Set up') };
}

export function resetOnboardingDraft() {
  draft = null;
}
