// App model: which store is active (device or demo), and cached profile/cards/photos.
import { IdbStore, MemoryStore } from './services/StorageService.js';
import { migrateCard, CARD_TYPES } from './services/ContactService.js';
import { forgetPhotoURL } from './services/PhotoService.js';
import { buildDemo } from './data/demo.js';
import { uid } from './utils/misc.js';

const deviceStore = new IdbStore();

export const state = {
  mode: 'device', // 'device' | 'demo'
  store: deviceStore,
  profile: null,
  cards: [],
  photos: new Map(),
  listeners: new Set(),
};

export function onChange(fn) {
  state.listeners.add(fn);
  return () => state.listeners.delete(fn);
}
function emit() {
  for (const fn of state.listeners) fn(state);
}

export async function load() {
  state.profile = await state.store.getProfile();
  state.cards = await state.store.listCards();
  state.photos = new Map();
  const ids = new Set([state.profile?.photoId, ...state.cards.map((c) => c.photoId)].filter(Boolean));
  await Promise.all([...ids].map(async (id) => {
    const p = await state.store.getPhoto(id);
    if (p) state.photos.set(id, p);
  }));
  emit();
  return state;
}

export async function enterDemo() {
  state.mode = 'demo';
  state.store = new MemoryStore(buildDemo());
  await load();
}

export async function exitDemo() {
  state.mode = 'device';
  state.store = deviceStore;
  await load();
}

export function deviceHasProfile() {
  return state.mode === 'device' && Boolean(state.profile && state.profile.fullName.trim());
}

export function getCard(id) {
  return state.cards.find((c) => c.id === id) || null;
}

export function getPhoto(id) {
  return id ? state.photos.get(id) || null : null;
}

/** Photo for a card: its own, else the profile photo. */
export function cardPhoto(card) {
  if (!card || card.photoMode === 'scene') return null;
  return getPhoto(card.photoId) || getPhoto(state.profile?.photoId);
}

export async function saveProfile(profile) {
  state.profile = await state.store.saveProfile(profile);
  emit();
  return state.profile;
}

export async function savePhoto(photo) {
  await state.store.savePhoto(photo);
  state.photos.set(photo.id, photo);
  return photo;
}

/** Delete a photo only if nothing references it any more. */
export async function deletePhotoIfUnused(id) {
  if (!id) return;
  const used = state.profile?.photoId === id || state.cards.some((c) => c.photoId === id);
  if (used) return;
  await state.store.deletePhoto(id);
  state.photos.delete(id);
  forgetPhotoURL(id);
}

export async function saveCard(card) {
  const saved = await state.store.saveCard(card);
  const i = state.cards.findIndex((c) => c.id === saved.id);
  if (i >= 0) state.cards[i] = saved;
  else state.cards.push(saved);
  state.cards.sort((a, b) => a.order - b.order);
  emit();
  return saved;
}

export async function deleteCard(id) {
  await state.store.deleteCard(id);
  state.cards = state.cards.filter((c) => c.id !== id);
  emit();
}

export function newCard(type = 'personal', patch = {}) {
  const order = state.cards.length ? Math.max(...state.cards.map((c) => c.order)) + 1 : 0;
  const def = CARD_TYPES[type] || CARD_TYPES.custom;
  return migrateCard({
    id: uid('card_'),
    type,
    title: def.label,
    displayName: state.profile?.preferredName || state.profile?.fullName || '',
    subtitle: '',
    preset: def.preset,
    shareFields: {},
    order,
    scene: ['sky', 'lake', 'dusk', 'forest', 'sand', 'rose'][order % 6],
    ...patch,
  });
}

export async function reloadAll() {
  await load();
}
