// Create or edit an identity card: type, look, and default sharing preset.
import { h, clear } from '../utils/dom.js';
import { t } from '../utils/i18n.js';
import { icon } from '../components/Icon.js';
import { Field, TopBar } from '../components/Controls.js';
import { IdentityCard } from '../components/IdentityCard.js';
import { toast } from '../components/Toast.js';
import { confirmSheet } from '../components/BottomSheet.js';
import { pickAndCropPhoto } from '../components/PhotoCropper.js';
import { state, getCard, newCard, saveCard, deleteCard, savePhoto, deletePhotoIfUnused, cardPhoto, getPhoto } from '../state.js';
import { CARD_TYPES, PRESETS, SCENES } from '../services/ContactService.js';
import { getSettings, setSettings } from '../services/SettingsService.js';
import { debounce, clone } from '../utils/misc.js';

export async function render(ctx, { id }) {
  const isNew = id === 'new';
  const existing = isNew ? null : getCard(id);
  if (!isNew && !existing) return ctx.notFound(t('This card no longer exists.'));
  const card = isNew ? newCard(state.cards.length ? 'professional' : 'personal') : clone(existing);
  let titleTouched = !isNew;
  const pendingPhotos = new Set(); // photos picked for a new card that isn't saved yet

  let deleted = false;
  const persist = debounce(async () => {
    if (isNew || deleted) return;
    try {
      await saveCard({ ...card });
    } catch {
      /* global storage handler shows the error */
    }
  }, 350);
  const changed = () => {
    renderPreview();
    persist();
  };

  const preview = h('div', { class: 'card-preview' });
  function renderPreview() {
    clear(preview).append(IdentityCard(card, { photo: cardPhoto(card), demo: state.mode === 'demo' }));
  }

  // type
  const typeRow = h('div', { class: 'chips' });
  function renderTypes() {
    typeRow.replaceChildren(
      ...Object.entries(CARD_TYPES).map(([k, v]) =>
        h(
          'button',
          {
            type: 'button',
            class: ['chip', card.type === k && 'on'],
            'aria-pressed': String(card.type === k),
            onclick: () => {
              card.type = k;
              if (!titleTouched) {
                card.title = t(v.label);
                titleInput.value = card.title;
              }
              if (isNew) {
                card.preset = v.preset;
                renderPresets();
              }
              renderTypes();
              changed();
            },
          },
          icon(v.icon, { size: 15 }),
          t(v.label),
        ),
      ),
    );
  }

  const titleField = Field({ label: t('Card name'), value: card.title, maxlength: 40, onInput: (v) => { titleTouched = true; card.title = v; changed(); }, testid: 'card-title' });
  const titleInput = titleField.querySelector('input');

  // look
  const lookBox = h('div', { class: 'stack' });
  function renderLook() {
    const own = getPhoto(card.photoId);
    const profilePhoto = getPhoto(state.profile.photoId);
    const swatches = h(
      'div',
      { class: 'swatches', role: 'radiogroup', 'aria-label': t('Backdrop') },
      SCENES.map((s) =>
        h('button', {
          type: 'button',
          role: 'radio',
          class: ['swatch', `scene-${s}`, card.scene === s && 'on'],
          'aria-checked': String(card.scene === s),
          'aria-label': t(s),
          onclick: () => {
            card.scene = s;
            if (own || profilePhoto) card.photoMode = 'scene';
            renderLook();
            changed();
          },
        }, h('span', { class: 'id-scene' })),
      ),
    );
    const usingPhoto = card.photoMode !== 'scene' && (own || profilePhoto);
    clear(lookBox).append(
      h(
        'div',
        { class: 'hstack wrap-row' },
        h('button', { type: 'button', class: 'btn sm secondary', onclick: pickPhoto }, icon('ImagePlus', { size: 16 }), own ? t('Change card photo') : t('Card photo')),
        own ? h('button', { type: 'button', class: 'btn sm ghost', onclick: removePhoto }, t('Remove')) : null,
        card.photoMode === 'scene' && (own || profilePhoto)
          ? h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { card.photoMode = 'auto'; renderLook(); changed(); } }, t('Use photo again'))
          : null,
      ),
      h(
        'p',
        { class: 'muted small' },
        usingPhoto
          ? own
            ? t('This card uses its own photo.')
            : t('This card uses your profile photo. Pick a backdrop below to use it instead.')
          : t('Painted backdrop. Add a photo for a more personal card.'),
      ),
      swatches,
    );
  }
  async function pickPhoto() {
    const res = await pickAndCropPhoto();
    if (!res) return;
    if (res.error) return toast(t('Couldn’t use that photo'), { kind: 'bad', body: res.error });
    const old = card.photoId;
    await savePhoto(res);
    if (isNew) pendingPhotos.add(res.id);
    card.photoId = res.id;
    card.photoMode = 'auto';
    renderLook();
    changed();
    await persist.flush();
    if (old) await deletePhotoIfUnused(old);
  }
  async function removePhoto() {
    const old = card.photoId;
    card.photoId = null;
    renderLook();
    changed();
    await persist.flush();
    if (old) await deletePhotoIfUnused(old);
  }

  // default preset
  const presetRow = h('div', { class: 'chips' });
  function renderPresets() {
    presetRow.replaceChildren(
      ...Object.entries(PRESETS).map(([k, p]) =>
        h(
          'button',
          {
            type: 'button',
            class: ['chip', card.preset === k && 'on'],
            'aria-pressed': String(card.preset === k),
            onclick: () => {
              card.preset = k;
              card.shareFields = {}; // the preset decides again
              renderPresets();
              changed();
            },
          },
          t(p.short),
        ),
      ),
    );
  }

  async function create() {
    if (!card.title.trim()) card.title = t(CARD_TYPES[card.type].label);
    const saved = await saveCard(card);
    pendingPhotos.clear();
    setSettings({ selectedCardId: saved.id });
    toast(t('Card created'), { kind: 'good', body: saved.title });
    ctx.go('/home', { replace: true, direction: 'back' });
  }

  async function remove() {
    if (state.cards.length <= 1) {
      const ok = await confirmSheet({ title: t('Delete your only card?'), message: t('You can create a new card any time.'), confirmLabel: t('Delete'), danger: true });
      if (!ok) return;
    }
    await persist.flush(); // keep the latest edits in the Undo snapshot
    deleted = true;
    const snapshot = clone(getCard(card.id) || card);
    await deleteCard(card.id);
    if (getSettings().selectedCardId === card.id) setSettings({ selectedCardId: null });
    ctx.go('/home', { replace: true, direction: 'back' });
    toast(t('Card deleted'), {
      body: snapshot.title,
      undo: async () => {
        if (getCard(snapshot.id)) return;
        await saveCard(snapshot);
        setSettings({ selectedCardId: snapshot.id });
        ctx.refreshSoon();
      },
    });
    // Photo record is kept until the notice is gone so Undo can restore it.
    setTimeout(() => {
      if (!getCard(snapshot.id) && snapshot.photoId) deletePhotoIfUnused(snapshot.photoId);
    }, 8000);
  }

  const el = h(
    'section',
    { class: 'card-screen' },
    TopBar({
      title: isNew ? t('New card') : t('Edit card'),
      onBack: async () => {
        await persist.flush();
        ctx.back();
      },
    }),
    h(
      'div',
      { class: ['scroll', isNew && 'has-actionbar'], 'data-scroll': '' },
      h(
        'div',
        { class: 'wrap' },
        preview,
        h('section', { class: 'section' }, h('h2', { class: 'section-title' }, t('Type')), typeRow),
        h(
          'section',
          { class: 'section' },
          h('h2', { class: 'section-title' }, t('On the card')),
          h(
            'div',
            { class: 'group pad' },
            titleField,
            Field({ label: t('Display name'), value: card.displayName, maxlength: 60, onInput: (v) => { card.displayName = v; changed(); }, testid: 'card-display-name' }),
            Field({ label: t('Subtitle'), value: card.subtitle, maxlength: 80, placeholder: t('e.g. Designer · Lumen Studio'), onInput: (v) => { card.subtitle = v; changed(); } }),
          ),
        ),
        h('section', { class: 'section' }, h('h2', { class: 'section-title' }, t('Look')), h('div', { class: 'group pad' }, lookBox)),
        h(
          'section',
          { class: 'section' },
          h('h2', { class: 'section-title' }, t('Shares by default')),
          presetRow,
          h('p', { class: 'muted small', style: { marginTop: '8px', paddingLeft: '6px' } }, t('You can fine-tune each detail before showing the QR.')),
        ),
        !isNew
          ? h(
              'section',
              { class: 'section' },
              h(
                'div',
                { class: 'group' },
                h('button', { type: 'button', class: 'row danger', onclick: remove, 'data-testid': 'delete-card' }, h('span', { class: 'row-icon' }, icon('Trash2', { size: 18 })), h('span', { class: 'row-text' }, h('span', { class: 'row-title' }, t('Delete card')))),
              ),
            )
          : null,
      ),
    ),
    isNew
      ? h('footer', { class: 'action-bar solid' }, h('button', { type: 'button', class: 'btn primary', onclick: create, 'data-testid': 'create-card' }, icon('Plus', { size: 18 }), t('Create card')))
      : null,
  );

  renderTypes();
  renderLook();
  renderPresets();
  renderPreview();

  return {
    el,
    title: isNew ? t('New card') : t('Edit card'),
    async destroy() {
      await persist.flush();
      // A new card that was abandoned: drop photos picked for it.
      for (const pid of pendingPhotos) await deletePhotoIfUnused(pid);
    },
  };
}
