// The privacy core of NEXO.
//
// 1. listShareItems(profile)  -> every shareable item the profile currently has
// 2. resolveSelection(card, profile) -> { itemKey: true|false } (unknown items default OFF)
// 3. buildSharePayload(profile, selection) -> ContactData built from an explicit
//    ALLOWLIST: it reads a profile value only when its key is selected === true.
//    It never spreads or copies the profile object.
//
// ContactData is the one shape used for QR, .vcf, the live preview and scanned
// contacts, so "what you see in the preview" is literally what gets encoded.

import { t } from '../utils/i18n.js';
import { uid, safeHttpUrl, cap } from '../utils/misc.js';

export const PROFILE_SCHEMA = 1;

export const SOCIAL_NETWORKS = {
  linkedin: { label: 'LinkedIn', base: 'https://www.linkedin.com/in/' },
  instagram: { label: 'Instagram', base: 'https://instagram.com/' },
  github: { label: 'GitHub', base: 'https://github.com/' },
  x: { label: 'X', base: 'https://x.com/' },
  youtube: { label: 'YouTube', base: 'https://youtube.com/@' },
  facebook: { label: 'Facebook', base: 'https://facebook.com/' },
  tiktok: { label: 'TikTok', base: 'https://www.tiktok.com/@' },
  telegram: { label: 'Telegram', base: 'https://t.me/' },
  other: { label: 'Other', base: '' },
};

export const PHONE_LABELS = ['Mobile', 'Work', 'Home', 'Other'];
export const EMAIL_LABELS = ['Personal', 'Work', 'Other'];

export const CARD_TYPES = {
  personal: { label: 'Personal', preset: 'personal', icon: 'User' },
  professional: { label: 'Professional', preset: 'professional', icon: 'Briefcase' },
  social: { label: 'Social', preset: 'social', icon: 'AtSign' },
  business: { label: 'Business', preset: 'professional', icon: 'Building2' },
  custom: { label: 'Custom', preset: 'custom', icon: 'Sparkles' },
};

/** Painted backdrops used when a card has no photo. */
export const SCENES = ['sky', 'lake', 'dusk', 'forest', 'sand', 'night', 'rose', 'mint'];

export const PRESETS = {
  personal: { label: 'Personal sharing', short: 'Personal', desc: 'Friends and family' },
  professional: { label: 'Professional networking', short: 'Professional', desc: 'Work contacts and events' },
  social: { label: 'Social sharing', short: 'Social', desc: 'Profiles and handles only' },
  custom: { label: 'Custom sharing', short: 'Custom', desc: 'Exactly what you pick' },
};

export function emptyProfile() {
  return {
    id: 'me',
    schema: PROFILE_SCHEMA,
    fullName: '',
    preferredName: '',
    photoId: null,
    jobTitle: '',
    company: '',
    phones: [],
    whatsapp: '',
    emails: [],
    website: '',
    socials: [],
    address: { street: '', city: '', region: '', postcode: '', country: '' },
    birthday: '',
    bio: '',
    custom: [],
    updatedAt: 0,
  };
}

/** Every saved field gets a default here. Never rename/remove a field without a migration. */
export function migrateProfile(raw) {
  const base = emptyProfile();
  const p = { ...base, ...(raw || {}) };
  p.id = 'me';
  for (const key of ['fullName', 'preferredName', 'jobTitle', 'company', 'whatsapp', 'website', 'birthday', 'bio']) {
    p[key] = typeof p[key] === 'string' ? p[key] : '';
  }
  p.phones = listOf(p.phones, (x) => ({ id: x.id || uid('p'), label: str(x.label) || 'Mobile', value: str(x.value) }));
  p.emails = listOf(p.emails, (x) => ({ id: x.id || uid('e'), label: str(x.label) || 'Personal', value: str(x.value) }));
  p.socials = listOf(p.socials, (x) => ({
    id: x.id || uid('s'),
    network: SOCIAL_NETWORKS[x.network] ? x.network : 'other',
    label: str(x.label),
    value: str(x.value),
  }));
  p.custom = listOf(p.custom, (x) => ({ id: x.id || uid('c'), label: str(x.label), value: str(x.value) }));
  const a = p.address && typeof p.address === 'object' ? p.address : {};
  p.address = {
    street: str(a.street), city: str(a.city), region: str(a.region), postcode: str(a.postcode), country: str(a.country),
  };
  p.photoId = typeof p.photoId === 'string' ? p.photoId : null;
  p.schema = PROFILE_SCHEMA;
  p.updatedAt = Number(p.updatedAt) || 0;
  return p;
}

export function migrateCard(raw, order = 0) {
  const c = raw || {};
  const type = CARD_TYPES[c.type] ? c.type : 'custom';
  return {
    id: str(c.id) || uid('card_'),
    type,
    title: str(c.title) || CARD_TYPES[type].label,
    displayName: str(c.displayName),
    subtitle: str(c.subtitle),
    photoId: typeof c.photoId === 'string' ? c.photoId : null,
    scene: SCENES.includes(c.scene) ? c.scene : 'sky',
    photoMode: c.photoMode === 'scene' ? 'scene' : 'auto', // auto: own photo → profile photo → scene
    // Only bundled demo images are allowed here (demo mode); real cards use photoId.
    staticPhoto: /^images\/demo\/[\w-]+\.(jpg|jpeg|webp|png)$/.test(c.staticPhoto || '') ? c.staticPhoto : '',
    tint: /^#[0-9a-f]{6}$/i.test(c.tint || '') ? c.tint : '',
    preset: PRESETS[c.preset] ? c.preset : CARD_TYPES[type].preset,
    shareFields: c.shareFields && typeof c.shareFields === 'object' ? sanitizeBoolMap(c.shareFields) : {},
    order: Number.isFinite(c.order) ? c.order : order,
    createdAt: Number(c.createdAt) || Date.now(),
    updatedAt: Number(c.updatedAt) || Date.now(),
  };
}

function str(v) {
  return typeof v === 'string' ? v : '';
}
function listOf(v, map) {
  return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object').map(map) : [];
}
function sanitizeBoolMap(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (typeof v === 'boolean' && /^[\w:-]{1,80}$/.test(k)) out[k] = v;
  return out;
}

export function addressText(a) {
  if (!a) return '';
  return [a.street, a.city, a.region, a.postcode, a.country].map((x) => (x || '').trim()).filter(Boolean).join(', ');
}

export function socialUrl(s) {
  const v = (s.value || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v) || /\.[a-z]{2,}\//i.test(v)) return safeHttpUrl(v);
  const net = SOCIAL_NETWORKS[s.network];
  if (net && net.base) return safeHttpUrl(net.base + v.replace(/^@/, ''));
  return safeHttpUrl(v);
}

export function socialLabel(s) {
  if (s.network === 'other') return s.label?.trim() || t('Profile');
  return SOCIAL_NETWORKS[s.network]?.label || t('Profile');
}

/**
 * Every item that can be shared, in display order. Only items with a value are listed.
 * group: identity | contact | work | social | personal
 */
export function listShareItems(profile, { hasPhoto = false } = {}) {
  const p = profile;
  const items = [];
  const push = (key, group, label, value, icon) => {
    if (String(value || '').trim()) items.push({ key, group, label, value: String(value), icon });
  };
  push('fullName', 'identity', t('Full name'), p.fullName, 'User');
  push('preferredName', 'identity', t('Preferred name'), p.preferredName, 'Smile');
  if (hasPhoto && p.photoId) items.push({ key: 'photo', group: 'identity', label: t('Photo'), value: t('Included in .vcf file only'), icon: 'Image' });
  push('jobTitle', 'work', t('Job title'), p.jobTitle, 'Briefcase');
  push('company', 'work', t('Company'), p.company, 'Building2');
  for (const ph of p.phones) push(`phone:${ph.id}`, 'contact', t(ph.label || 'Phone'), ph.value, 'Phone');
  push('whatsapp', 'contact', 'WhatsApp', p.whatsapp, 'whatsapp');
  for (const em of p.emails) push(`email:${em.id}`, 'contact', `${t('Email')} · ${t(em.label || 'Other')}`, em.value, 'Mail');
  push('website', 'contact', t('Website'), p.website, 'Globe');
  for (const s of p.socials) push(`social:${s.id}`, 'social', socialLabel(s), s.value, s.network);
  push('address', 'personal', t('Address'), addressText(p.address), 'MapPin');
  push('birthday', 'personal', t('Birthday'), p.birthday, 'Cake');
  push('bio', 'personal', t('Short bio'), p.bio, 'Quote');
  for (const c of p.custom) if (c.label.trim()) push(`custom:${c.id}`, 'personal', c.label, c.value, 'Tag');
  return items;
}

/** What a preset turns on for a given item. Pure function of the item and profile. */
export function presetIncludes(presetId, key, profile) {
  const [kind, id] = key.split(':');
  const email = kind === 'email' ? profile.emails.find((e) => e.id === id) : null;
  const phone = kind === 'phone' ? profile.phones.find((e) => e.id === id) : null;
  const social = kind === 'social' ? profile.socials.find((e) => e.id === id) : null;
  const hasWorkEmail = profile.emails.some((e) => e.label === 'Work' && e.value.trim());
  const hasNonWorkEmail = profile.emails.some((e) => e.label !== 'Work' && e.value.trim());

  switch (presetId) {
    case 'personal':
      if (['fullName', 'preferredName', 'photo', 'whatsapp', 'birthday'].includes(kind)) return true;
      if (phone) return true;
      if (email) return hasNonWorkEmail ? email.label !== 'Work' : true;
      if (social) return ['instagram', 'x', 'facebook', 'tiktok', 'telegram'].includes(social.network);
      return false;
    case 'professional':
      if (['fullName', 'photo', 'jobTitle', 'company', 'website'].includes(kind)) return true;
      if (phone) return phone.label !== 'Home';
      if (email) return hasWorkEmail ? email.label === 'Work' : true;
      if (social) return ['linkedin', 'github'].includes(social.network);
      return false;
    case 'social':
      if (['fullName', 'preferredName', 'photo', 'website'].includes(kind)) return true;
      if (social) return true;
      return false;
    case 'custom':
    default:
      return kind === 'fullName';
  }
}

export function resolveSelection(card, profile, opts) {
  const items = listShareItems(profile, opts);
  const sel = {};
  for (const item of items) {
    const saved = card.shareFields?.[item.key];
    if (typeof saved === 'boolean') sel[item.key] = saved;
    else if (card.preset && card.preset !== 'custom') sel[item.key] = presetIncludes(card.preset, item.key, profile);
    else sel[item.key] = false; // privacy default: new items are OFF
  }
  return sel;
}

export function selectionForPreset(presetId, profile, opts) {
  const sel = {};
  for (const item of listShareItems(profile, opts)) sel[item.key] = presetIncludes(presetId, item.key, profile);
  return sel;
}

/** Explicit allowlist: each value is read only when selection[key] === true. */
export function buildSharePayload(profile, selection) {
  const on = (key) => selection?.[key] === true;
  const p = profile;
  const data = {
    fullName: on('fullName') ? cap(p.fullName.trim(), 200) : '',
    preferredName: on('preferredName') ? cap(p.preferredName.trim(), 200) : '',
    jobTitle: on('jobTitle') ? cap(p.jobTitle.trim(), 200) : '',
    company: on('company') ? cap(p.company.trim(), 200) : '',
    phones: [],
    emails: [],
    urls: [],
    address: null,
    birthday: on('birthday') ? cap(p.birthday.trim(), 10) : '',
    note: '',
    includePhoto: on('photo') && Boolean(p.photoId),
  };
  for (const ph of p.phones) if (on(`phone:${ph.id}`) && ph.value.trim()) data.phones.push({ label: ph.label || 'Mobile', value: ph.value.trim() });
  if (on('whatsapp') && p.whatsapp.trim()) data.phones.push({ label: 'WhatsApp', value: p.whatsapp.trim() });
  for (const em of p.emails) if (on(`email:${em.id}`) && em.value.trim()) data.emails.push({ label: em.label || 'Other', value: em.value.trim() });
  if (on('website')) {
    const url = safeHttpUrl(p.website);
    if (url) data.urls.push({ label: 'Website', url });
  }
  for (const s of p.socials) {
    if (!on(`social:${s.id}`)) continue;
    const url = socialUrl(s);
    if (url) data.urls.push({ label: socialLabel(s), url });
  }
  if (on('address') && addressText(p.address)) {
    const a = p.address;
    data.address = { street: a.street.trim(), city: a.city.trim(), region: a.region.trim(), postcode: a.postcode.trim(), country: a.country.trim() };
  }
  const noteParts = [];
  if (on('bio') && p.bio.trim()) noteParts.push(cap(p.bio.trim(), 600));
  for (const c of p.custom) if (on(`custom:${c.id}`) && c.label.trim() && c.value.trim()) noteParts.push(`${c.label.trim()}: ${c.value.trim()}`);
  data.note = noteParts.join('\n');
  return data;
}

export function payloadIsEmpty(data) {
  return !(
    data.fullName || data.preferredName || data.jobTitle || data.company || data.phones.length ||
    data.emails.length || data.urls.length || data.address || data.birthday || data.note
  );
}

/** Rows for the "You are sharing" preview, rendered from the payload itself. */
export function payloadRows(data) {
  const rows = [];
  if (data.fullName) rows.push({ icon: 'User', label: t('Name'), value: data.fullName });
  if (data.preferredName) rows.push({ icon: 'Smile', label: t('Preferred name'), value: data.preferredName });
  if (data.jobTitle) rows.push({ icon: 'Briefcase', label: t('Job title'), value: data.jobTitle });
  if (data.company) rows.push({ icon: 'Building2', label: t('Company'), value: data.company });
  for (const ph of data.phones) rows.push({ icon: ph.label === 'WhatsApp' ? 'whatsapp' : 'Phone', label: t(ph.label), value: ph.value });
  for (const em of data.emails) rows.push({ icon: 'Mail', label: `${t('Email')} · ${t(em.label)}`, value: em.value });
  for (const u of data.urls) rows.push({ icon: urlIcon(u.label), label: u.label, value: u.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') });
  if (data.address) rows.push({ icon: 'MapPin', label: t('Address'), value: addressText(data.address) });
  if (data.birthday) rows.push({ icon: 'Cake', label: t('Birthday'), value: data.birthday });
  if (data.note) rows.push({ icon: 'Quote', label: t('Note'), value: data.note });
  if (data.includePhoto) rows.push({ icon: 'Image', label: t('Photo'), value: t('In the .vcf file only (too large for a QR)') });
  return rows;
}

function urlIcon(label) {
  const key = Object.keys(SOCIAL_NETWORKS).find((k) => SOCIAL_NETWORKS[k].label === label);
  return key && key !== 'other' ? key : 'Globe';
}

export const GROUPS = [
  { id: 'identity', label: 'Identity' },
  { id: 'contact', label: 'Contact' },
  { id: 'work', label: 'Work' },
  { id: 'social', label: 'Social' },
  { id: 'personal', label: 'Personal' },
];
