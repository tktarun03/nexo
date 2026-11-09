// My Profile — every detail you might share. Saves automatically as you type.
import { h, clear } from '../utils/dom.js';
import { t } from '../utils/i18n.js';
import { icon } from '../components/Icon.js';
import { Field, TopBar } from '../components/Controls.js';
import { toast } from '../components/Toast.js';
import { pickAndCropPhoto } from '../components/PhotoCropper.js';
import { state, saveProfile, savePhoto, deletePhotoIfUnused, getPhoto } from '../state.js';
import { PHONE_LABELS, EMAIL_LABELS, SOCIAL_NETWORKS } from '../services/ContactService.js';
import { photoURL } from '../services/PhotoService.js';
import { debounce, uid, clone, initials } from '../utils/misc.js';

export async function render(ctx) {
  let profile = clone(state.profile);
  const saveState = h('span', { class: 'save-state', 'aria-live': 'polite', 'data-testid': 'save-state' }, icon('Check', { size: 14 }), t('Saved'));

  const persist = debounce(async () => {
    try {
      const saved = await saveProfile(profile);
      // keep ids/defaults from migration, but never clobber fields being typed
      profile.updatedAt = saved.updatedAt;
      saveState.replaceChildren(icon('Check', { size: 14 }), t('Saved'));
    } catch {
      saveState.replaceChildren(icon('CircleAlert', { size: 14 }), t('Not saved'));
    }
  }, 450);
  const changed = () => {
    saveState.replaceChildren(t('Saving…'));
    persist();
  };
  const set = (key) => (v) => {
    profile[key] = v;
    changed();
  };

  // ---- photo ----
  const photoBox = h('div', { class: 'profile-photo' });
  function renderPhoto() {
    const ph = getPhoto(profile.photoId);
    clear(photoBox).append(
      h(
        'button',
        { type: 'button', class: 'avatar-xl', 'aria-label': ph ? t('Change photo') : t('Add photo'), onclick: changePhoto, 'data-testid': 'profile-photo' },
        ph ? h('img', { src: photoURL(ph), alt: '' }) : h('span', null, initials(profile.fullName) === '·' ? icon('Camera', { size: 28 }) : initials(profile.fullName)),
        h('span', { class: 'avatar-edit' }, icon('Camera', { size: 16 })),
      ),
      h(
        'div',
        { class: 'hstack' },
        h('button', { type: 'button', class: 'btn sm secondary', onclick: changePhoto }, ph ? t('Change photo') : t('Add photo')),
        ph ? h('button', { type: 'button', class: 'btn sm ghost', onclick: removePhoto }, t('Remove')) : null,
      ),
    );
  }
  async function changePhoto() {
    const res = await pickAndCropPhoto();
    if (!res) return;
    if (res.error) return toast(t('Couldn’t use that photo'), { kind: 'bad', body: res.error });
    const old = profile.photoId;
    await savePhoto(res);
    profile.photoId = res.id;
    await persist.flush();
    await deletePhotoIfUnused(old);
    renderPhoto();
    toast(t('Photo updated'), { kind: 'good' });
  }
  async function removePhoto() {
    const old = profile.photoId;
    profile.photoId = null;
    await persist.flush();
    renderPhoto();
    toast(t('Photo removed'), {
      undo: async () => {
        if (!getPhoto(old)) throw new Error(t('The photo is no longer available.'));
        profile.photoId = old;
        await persist.flush();
        renderPhoto();
      },
    });
    // Keep the photo record until the notice is gone so Undo can bring it back.
    setTimeout(() => {
      if (state.profile.photoId !== old) deletePhotoIfUnused(old);
    }, 8000);
  }

  // ---- repeatable lists ----
  function listSection({ key, title, addLabel, testid, makeItem, renderItem, noun }) {
    const box = h('div', { class: 'stack' });
    const draw = () => {
      clear(box).append(
        ...profile[key].map((item, i) => renderItem(item, () => remove(i))),
        h('button', { type: 'button', class: 'add-row', onclick: add, 'data-testid': testid }, icon('Plus', { size: 18 }), addLabel),
      );
    };
    const add = () => {
      profile[key] = [...profile[key], makeItem()];
      draw();
      const inputs = box.querySelectorAll('input');
      inputs[inputs.length - 1]?.focus();
    };
    const remove = (i) => {
      const removed = profile[key][i];
      profile[key] = profile[key].filter((_, j) => j !== i);
      draw();
      changed();
      const hadContent = removed && ((removed.value || '').trim() || (key === 'custom' && (removed.label || '').trim()));
      if (hadContent) {
        toast(t('Removed {noun}', { noun }), {
          body: removed.value || removed.label,
          undo: async () => {
            const list = [...profile[key]];
            if (list.some((x) => x.id === removed.id)) return;
            list.splice(Math.min(i, list.length), 0, removed);
            profile[key] = list;
            draw();
            await persist.flush();
          },
        });
      }
    };
    draw();
    return h('section', { class: 'section' }, h('h2', { class: 'section-title' }, title), h('div', { class: 'group pad' }, box));
  }

  const labelSelect = (options, value, onChange, aria) => {
    const sel = h('select', { class: 'input', 'aria-label': aria, onchange: (e) => onChange(e.target.value) }, options.map((o) => h('option', { value: o.value }, o.label)));
    sel.value = value;
    return sel;
  };
  const removeBtn = (onRemove, aria) => h('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': aria, onclick: onRemove }, icon('Minus', { size: 18 }));

  const phones = listSection({
    key: 'phones',
    title: t('Phone numbers'),
    addLabel: t('Add phone'),
    noun: t('phone'),
    testid: 'add-phone',
    makeItem: () => ({ id: uid('p'), label: 'Mobile', value: '' }),
    renderItem: (item, onRemove) =>
      h(
        'div',
        { class: 'multi-row' },
        labelSelect(PHONE_LABELS.map((l) => ({ value: l, label: t(l) })), item.label, (v) => { item.label = v; changed(); }, t('Phone label')),
        h('input', { class: 'input', type: 'tel', inputmode: 'tel', autocomplete: 'tel', value: item.value, placeholder: '+974 5555 0000', 'aria-label': t('Phone number'), 'data-testid': 'phone-input', oninput: (e) => { item.value = e.target.value; changed(); } }),
        removeBtn(onRemove, t('Remove phone')),
      ),
  });

  const emails = listSection({
    key: 'emails',
    title: t('Email addresses'),
    addLabel: t('Add email'),
    noun: t('email'),
    testid: 'add-email',
    makeItem: () => ({ id: uid('e'), label: profile.emails.length ? 'Work' : 'Personal', value: '' }),
    renderItem: (item, onRemove) =>
      h(
        'div',
        { class: 'multi-row' },
        labelSelect(EMAIL_LABELS.map((l) => ({ value: l, label: t(l) })), item.label, (v) => { item.label = v; changed(); }, t('Email label')),
        h('input', { class: 'input', type: 'email', inputmode: 'email', autocomplete: 'email', value: item.value, placeholder: 'you@example.com', 'aria-label': t('Email address'), 'data-testid': 'email-input', oninput: (e) => { item.value = e.target.value; changed(); } }),
        removeBtn(onRemove, t('Remove email')),
      ),
  });

  const socials = listSection({
    key: 'socials',
    title: t('Social profiles'),
    addLabel: t('Add profile'),
    noun: t('profile'),
    testid: 'add-social',
    makeItem: () => {
      const used = new Set(profile.socials.map((s) => s.network));
      const next = ['linkedin', 'instagram', 'github', 'x'].find((n) => !used.has(n)) || 'other';
      return { id: uid('s'), network: next, label: '', value: '' };
    },
    renderItem: (item, onRemove) => {
      const labelInput = h('input', { class: 'input', value: item.label, placeholder: t('Name, e.g. Behance'), 'aria-label': t('Profile name'), hidden: item.network !== 'other', oninput: (e) => { item.label = e.target.value; changed(); } });
      return h(
        'div',
        { class: 'stack tight' },
        h(
          'div',
          { class: 'multi-row' },
          labelSelect(Object.entries(SOCIAL_NETWORKS).map(([k, v]) => ({ value: k, label: t(v.label) })), item.network, (v) => {
            item.network = v;
            labelInput.hidden = v !== 'other';
            changed();
          }, t('Network')),
          h('input', { class: 'input', type: 'text', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', value: item.value, placeholder: t('@handle or link'), 'aria-label': t('Handle or link'), oninput: (e) => { item.value = e.target.value; changed(); } }),
          removeBtn(onRemove, t('Remove profile')),
        ),
        labelInput,
      );
    },
  });

  const custom = listSection({
    key: 'custom',
    title: t('Custom fields'),
    addLabel: t('Add custom field'),
    noun: t('field'),
    testid: 'add-custom',
    makeItem: () => ({ id: uid('c'), label: '', value: '' }),
    renderItem: (item, onRemove) =>
      h(
        'div',
        { class: 'custom-row' },
        h('input', { class: 'input', value: item.label, placeholder: t('Label, e.g. Pronouns'), 'aria-label': t('Field label'), oninput: (e) => { item.label = e.target.value; changed(); } }),
        h('input', { class: 'input', value: item.value, placeholder: t('Value'), 'aria-label': t('Field value'), oninput: (e) => { item.value = e.target.value; changed(); } }),
        removeBtn(onRemove, t('Remove field')),
      ),
  });

  const addr = profile.address;
  const setAddr = (k) => (v) => {
    profile.address = { ...profile.address, [k]: v };
    changed();
  };

  const el = h(
    'section',
    { class: 'profile-screen' },
    TopBar({ title: t('My profile'), actions: [saveState] }),
    h(
      'div',
      { class: 'scroll', 'data-scroll': '' },
      h(
        'form',
        { class: 'wrap', autocomplete: 'on', onsubmit: (e) => e.preventDefault() },
        photoBox,
        h('p', { class: 'muted small center', style: { margin: '6px 0 4px' } }, t('Stored only on this device. You choose what to share for each card.')),
        h(
          'section',
          { class: 'section' },
          h('h2', { class: 'section-title' }, t('Name')),
          h(
            'div',
            { class: 'group pad' },
            Field({ label: t('Full name'), value: profile.fullName, autocomplete: 'name', onInput: set('fullName'), testid: 'full-name' }),
            Field({ label: t('Preferred name'), value: profile.preferredName, autocomplete: 'nickname', onInput: set('preferredName'), hint: t('What friends call you') }),
          ),
        ),
        h(
          'section',
          { class: 'section' },
          h('h2', { class: 'section-title' }, t('Work')),
          h(
            'div',
            { class: 'group pad' },
            Field({ label: t('Job title'), value: profile.jobTitle, autocomplete: 'organization-title', onInput: set('jobTitle') }),
            Field({ label: t('Company'), value: profile.company, autocomplete: 'organization', onInput: set('company') }),
          ),
        ),
        phones,
        h(
          'section',
          { class: 'section' },
          h('h2', { class: 'section-title' }, 'WhatsApp'),
          h('div', { class: 'group pad' }, Field({ label: t('WhatsApp number'), value: profile.whatsapp, type: 'tel', inputmode: 'tel', onInput: set('whatsapp'), hint: t('Include your country code, e.g. +974') })),
        ),
        emails,
        h(
          'section',
          { class: 'section' },
          h('h2', { class: 'section-title' }, t('Website')),
          h('div', { class: 'group pad' }, Field({ label: t('Website'), value: profile.website, type: 'url', inputmode: 'url', autocomplete: 'url', placeholder: 'example.com', onInput: set('website') })),
        ),
        socials,
        h(
          'section',
          { class: 'section' },
          h('h2', { class: 'section-title' }, t('Address')),
          h(
            'div',
            { class: 'group pad' },
            Field({ label: t('Street'), value: addr.street, autocomplete: 'street-address', onInput: setAddr('street') }),
            h(
              'div',
              { class: 'two-col' },
              Field({ label: t('City'), value: addr.city, autocomplete: 'address-level2', onInput: setAddr('city') }),
              Field({ label: t('State / region'), value: addr.region, autocomplete: 'address-level1', onInput: setAddr('region') }),
            ),
            h(
              'div',
              { class: 'two-col' },
              Field({ label: t('Postcode'), value: addr.postcode, autocomplete: 'postal-code', onInput: setAddr('postcode') }),
              Field({ label: t('Country'), value: addr.country, autocomplete: 'country-name', onInput: setAddr('country') }),
            ),
          ),
        ),
        h(
          'section',
          { class: 'section' },
          h('h2', { class: 'section-title' }, t('About you')),
          h(
            'div',
            { class: 'group pad' },
            Field({ label: t('Birthday'), value: profile.birthday, type: 'date', autocomplete: 'bday', onInput: set('birthday') }),
            Field({ label: t('Short bio'), value: profile.bio, multiline: true, maxlength: 400, onInput: set('bio'), hint: t('A line or two. Shared as a note.') }),
          ),
        ),
        custom,
      ),
    ),
  );

  renderPhoto();
  return { el, title: t('My profile'), destroy: () => persist.flush() };
}
