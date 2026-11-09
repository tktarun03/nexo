// Photos are stored as ArrayBuffers (safest across iOS IndexedDB versions)
// with a tint colour sampled from the lower part of the image, used for the
// cinematic gradient that fades into the bottom of each card.
import { uid } from '../utils/misc.js';

const urlCache = new Map();

export const MAX_PHOTO_INPUT = 25 * 1024 * 1024; // refuse absurd files early
export const CARD_PHOTO_W = 1080;
export const CARD_PHOTO_H = 1440; // 3:4 portrait

export async function loadImageFromFile(file) {
  if (!file || !/^image\//.test(file.type || 'image/')) throw new Error('Please choose an image file.');
  if (file.size > MAX_PHOTO_INPUT) throw new Error('That image is too large (over 25 MB).');
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall back to <img>, e.g. HEIC on some browsers */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new Error('This image format is not supported here. Try a JPEG or PNG.');
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Average colour of the bottom 35% of a canvas, darkened slightly for legible white text. */
export function sampleTint(canvas) {
  const w = 24;
  const h = 32;
  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  const ctx = small.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, w, h);
  const { data } = ctx.getImageData(0, Math.floor(h * 0.65), w, Math.ceil(h * 0.35));
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n += 1;
  }
  const k = 0.72;
  const hex = (v) => Math.round((v / n) * k).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export async function canvasToPhoto(canvas, { quality = 0.86 } = {}) {
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process the photo.'))), 'image/jpeg', quality),
  );
  return {
    id: uid('ph_'),
    type: 'image/jpeg',
    buffer: await blob.arrayBuffer(),
    width: canvas.width,
    height: canvas.height,
    tint: sampleTint(canvas),
    createdAt: Date.now(),
  };
}

export function photoBlob(photo) {
  if (!photo) return null;
  if (photo.buffer) return new Blob([photo.buffer], { type: photo.type || 'image/jpeg' });
  return null;
}

export function photoURL(photo) {
  if (!photo) return '';
  if (urlCache.has(photo.id)) return urlCache.get(photo.id);
  const blob = photoBlob(photo);
  if (!blob) return '';
  const url = URL.createObjectURL(blob);
  urlCache.set(photo.id, url);
  return url;
}

export function forgetPhotoURL(id) {
  const url = urlCache.get(id);
  if (url) URL.revokeObjectURL(url);
  urlCache.delete(id);
}

/** Small square JPEG (base64, no prefix) for a vCard PHOTO line. */
export async function photoBase64ForVCard(photo, size = 320) {
  const blob = photoBlob(photo);
  if (!blob) return '';
  const bmp = await createImageBitmap(blob);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  // centre-top crop: portraits keep the face
  ctx.drawImage(bmp, (bmp.width - side) / 2, Math.max(0, (bmp.height - side) * 0.25), side, side, 0, 0, size, size);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  return dataUrl.split(',')[1] || '';
}

export function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function base64ToBuffer(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
