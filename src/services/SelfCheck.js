// Built-in self-check, runnable on the phone from Settings.
import { buildSharePayload } from './ContactService.js';
import { encodeVCard, parseScanned } from './VCard.js';
import { roundTrip } from './QRService.js';
import { swStatus } from './PwaService.js';
import { VERSION } from '../version.js';

/** @returns {Promise<Array<{name:string, status:'pass'|'warn'|'fail', detail:string}>>} */
export async function runSelfCheck(store) {
  const results = [];
  const add = (name, status, detail = '') => results.push({ name, status, detail });

  add('App version', 'pass', VERSION);

  try {
    add('Local database', (await store.probe()) ? 'pass' : 'fail', store.kind === 'demo' ? 'Demo store (memory)' : 'IndexedDB read/write OK');
  } catch (e) {
    add('Local database', 'fail', e?.message || 'IndexedDB unavailable');
  }

  try {
    localStorage.setItem('nexo.__probe', '1');
    localStorage.removeItem('nexo.__probe');
    add('Settings storage', 'pass', 'localStorage OK');
  } catch {
    add('Settings storage', 'warn', 'Blocked (private mode?) — settings won’t persist');
  }

  // Privacy: excluded fields must never reach the QR text.
  try {
    const secret = 'ZZ_PRIVATE_ZZ';
    const profile = {
      fullName: 'Test Person', preferredName: secret, jobTitle: '', company: '', photoId: null,
      phones: [{ id: 'a', label: 'Mobile', value: '+1 555 0100' }, { id: 'b', label: 'Home', value: secret }],
      whatsapp: secret, emails: [{ id: 'e', label: 'Work', value: `${secret}@example.com` }], website: '',
      socials: [], address: { street: secret, city: '', region: '', postcode: '', country: '' }, birthday: '', bio: secret, custom: [],
    };
    const text = encodeVCard(buildSharePayload(profile, { fullName: true, 'phone:a': true }));
    add('Privacy filter', text.includes(secret) ? 'fail' : 'pass', text.includes(secret) ? 'Excluded data leaked into QR' : 'Only selected details are encoded');
    const back = parseScanned(text);
    add('vCard round trip', back.kind === 'contact' && back.contact.fullName === 'Test Person' ? 'pass' : 'fail', 'Encode → parse');
  } catch (e) {
    add('Privacy filter', 'fail', e?.message || 'Error');
  }

  try {
    const ok = await roundTrip(encodeVCard({ fullName: 'QR Test', phones: [{ label: 'Mobile', value: '+1 555 0100' }], emails: [], urls: [], address: null, birthday: '', note: '', preferredName: '', jobTitle: '', company: '' }));
    add('QR encode → decode', ok ? 'pass' : 'fail', ok ? 'Generated QR decodes on this device' : 'Decoded text did not match');
  } catch (e) {
    add('QR encode → decode', 'fail', e?.message || 'Error');
  }

  const camera = window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia);
  add('Camera access', camera ? 'pass' : 'warn', camera ? 'Available (permission asked when scanning)' : 'Needs HTTPS; scanning from a photo still works');
  let native = false;
  try {
    native = 'BarcodeDetector' in window && ((await window.BarcodeDetector.getSupportedFormats?.()) || []).includes('qr_code');
  } catch {
    native = false;
  }
  add('QR scanner', 'pass', native ? 'Native detector' : 'Bundled decoder (jsQR)');
  add('Keep screen awake', 'wakeLock' in navigator ? 'pass' : 'warn', 'wakeLock' in navigator ? 'Screen Wake Lock supported' : 'Not supported — screen may dim while showing a QR');
  add('Share sheet', navigator.share ? 'pass' : 'warn', navigator.share ? 'Web Share available' : 'Falls back to download / copy');

  const sw = await swStatus();
  add('Offline support', sw === 'active' ? 'pass' : 'warn', { active: 'Service worker active', dev: 'Disabled in development', installing: 'Installing…', 'not-registered': 'Not registered yet — reload once online', unsupported: 'Not supported by this browser' }[sw]);

  try {
    const persisted = await navigator.storage?.persisted?.();
    add('Storage protection', persisted ? 'pass' : 'warn', persisted ? 'Browser won’t clear data automatically' : 'Browser may clear data if space runs low — keep a backup');
  } catch {
    add('Storage protection', 'warn', 'Unknown');
  }
  return results;
}
