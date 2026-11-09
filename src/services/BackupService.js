// JSON backup and restore. The file contains everything (including photos), so
// the app tells the user to keep it private. Imported files are untrusted:
// every field is type-checked, length-capped and migrated before it is stored.
import { VERSION } from '../version.js';
import { migrateProfile, migrateCard } from './ContactService.js';
import { bufferToBase64, base64ToBuffer } from './PhotoService.js';

export const BACKUP_FORMAT = 1;
export const MAX_BACKUP_BYTES = 40 * 1024 * 1024;
const MAX_CARDS = 50;
const MAX_PHOTOS = 60;

export async function buildBackup(store) {
  const [profile, cards, photos] = await Promise.all([store.getProfile(), store.listCards(), store.listPhotos()]);
  return {
    app: 'nexo',
    format: BACKUP_FORMAT,
    appVersion: VERSION,
    exportedAt: new Date().toISOString(),
    profile,
    cards,
    photos: photos.map((p) => ({
      id: p.id,
      type: p.type,
      width: p.width,
      height: p.height,
      tint: p.tint,
      createdAt: p.createdAt,
      data: bufferToBase64(p.buffer),
    })),
  };
}

export function backupFileName(date = new Date()) {
  const d = date.toISOString().slice(0, 10);
  return `nexo-backup-${d}.json`;
}

/** Parse and validate a backup file's text. Throws a user-readable Error. */
export function parseBackup(text) {
  if (typeof text !== 'string' || text.length > MAX_BACKUP_BYTES) throw new Error('This file is too large to be a NEXO backup.');
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (!raw || raw.app !== 'nexo') throw new Error('This is not a NEXO backup file.');
  if (raw.format > BACKUP_FORMAT) throw new Error('This backup is from a newer NEXO. Update the app first.');

  const profile = raw.profile ? migrateProfile(raw.profile) : null;
  const cards = (Array.isArray(raw.cards) ? raw.cards : []).slice(0, MAX_CARDS).map((c, i) => migrateCard(c, i));
  const photos = [];
  for (const p of (Array.isArray(raw.photos) ? raw.photos : []).slice(0, MAX_PHOTOS)) {
    if (!p || typeof p.id !== 'string' || !/^[\w-]{1,64}$/.test(p.id) || typeof p.data !== 'string') continue;
    if (!/^image\/(jpeg|png|webp)$/.test(p.type || '')) continue;
    let buffer;
    try {
      buffer = base64ToBuffer(p.data);
    } catch {
      continue;
    }
    photos.push({
      id: p.id,
      type: p.type,
      buffer,
      width: Number(p.width) || 0,
      height: Number(p.height) || 0,
      tint: /^#[0-9a-f]{6}$/i.test(p.tint || '') ? p.tint : '',
      createdAt: Number(p.createdAt) || Date.now(),
    });
  }
  // Drop references to photos that are not in the file.
  const ids = new Set(photos.map((p) => p.id));
  if (profile && profile.photoId && !ids.has(profile.photoId)) profile.photoId = null;
  for (const c of cards) if (c.photoId && !ids.has(c.photoId)) c.photoId = null;
  return { profile, cards, photos, exportedAt: String(raw.exportedAt || '') };
}
