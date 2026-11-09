// vCard 3.0 encoder and a defensive parser for scanned content.
// vCard 3.0 is what iPhone and Android cameras/Contacts recognise most reliably.
// Labels for WhatsApp and social links use Apple's itemN.X-ABLabel grouping; other
// apps simply import them as phone numbers / URLs.

import { cap, safeHttpUrl } from '../utils/misc.js';

const CRLF = '\r\n';

export function escapeValue(v) {
  return String(v ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function splitName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { given: parts[0] || '', family: '' };
  return { given: parts.slice(0, -1).join(' '), family: parts[parts.length - 1] };
}

const PHONE_TYPE = { Mobile: 'CELL', Work: 'WORK,VOICE', Home: 'HOME,VOICE' };
const EMAIL_TYPE = { Work: 'INTERNET,WORK', Personal: 'INTERNET,HOME' };

/**
 * @param {object} data ContactData (see ContactService.buildSharePayload)
 * @param {{photoBase64?: string, fold?: boolean}} opts photo only for .vcf files, never QR
 */
export function encodeVCard(data, opts = {}) {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
  let item = 0;
  const labelled = (prop, value, label) => {
    item += 1;
    lines.push(`item${item}.${prop}:${value}`);
    lines.push(`item${item}.X-ABLabel:${escapeValue(label)}`);
  };

  const display = data.fullName || data.preferredName || data.company || 'NEXO contact';
  if (data.fullName) {
    const n = splitName(data.fullName);
    lines.push(`N:${escapeValue(n.family)};${escapeValue(n.given)};;;`);
  } else {
    lines.push('N:;;;;');
  }
  lines.push(`FN:${escapeValue(display)}`);
  if (data.preferredName) lines.push(`NICKNAME:${escapeValue(data.preferredName)}`);
  if (data.company) lines.push(`ORG:${escapeValue(data.company)}`);
  if (data.jobTitle) lines.push(`TITLE:${escapeValue(data.jobTitle)}`);

  for (const ph of data.phones || []) {
    const type = PHONE_TYPE[ph.label];
    const value = escapeValue(ph.value);
    if (type) lines.push(`TEL;TYPE=${type}:${value}`);
    else labelled('TEL', value, ph.label || 'Other');
  }
  for (const em of data.emails || []) {
    const type = EMAIL_TYPE[em.label] || 'INTERNET';
    lines.push(`EMAIL;TYPE=${type}:${escapeValue(em.value)}`);
  }
  for (const u of data.urls || []) {
    // URL values are not comma-escaped by most readers; they are already validated http(s).
    const url = String(u.url).replace(/[\r\n]/g, '');
    if (!u.label || u.label === 'Website') lines.push(`URL:${url}`);
    else labelled('URL', url, u.label);
  }
  if (data.address) {
    const a = data.address;
    lines.push(`ADR;TYPE=HOME:;;${[a.street, a.city, a.region, a.postcode, a.country].map(escapeValue).join(';')}`);
  }
  if (data.birthday && /^\d{4}-\d{2}-\d{2}$/.test(data.birthday)) lines.push(`BDAY:${data.birthday}`);
  if (data.note) lines.push(`NOTE:${escapeValue(data.note)}`);
  if (opts.photoBase64) lines.push(`PHOTO;ENCODING=b;TYPE=JPEG:${opts.photoBase64}`);
  lines.push('END:VCARD');
  const out = opts.fold ? lines.map(foldLine) : lines;
  return out.join(CRLF) + (opts.fold ? CRLF : '');
}

/** RFC 6350 line folding at 75 octets (used for .vcf files, not QR). */
export function foldLine(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const chunks = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const len = enc.encode(ch).length;
    const limit = chunks.length === 0 ? 75 : 74;
    if (size + len > limit) {
      chunks.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += len;
  }
  chunks.push(current);
  return chunks.join(`${CRLF} `);
}

// ---------------------------------------------------------------------------
// Parsing (untrusted input)
// ---------------------------------------------------------------------------

export const MAX_SCAN_CHARS = 8000;
const MAX_ITEMS = 20;

export function emptyContact() {
  return { fullName: '', preferredName: '', jobTitle: '', company: '', phones: [], emails: [], urls: [], address: null, birthday: '', note: '', includePhoto: false };
}

/**
 * Classify and parse scanned or pasted text.
 * @returns {{kind:'contact', contact:object, format:string} | {kind:'url', url:string} | {kind:'text', text:string} | {kind:'empty'}}
 */
export function parseScanned(raw) {
  const text = String(raw ?? '').replace(/^﻿/, '').slice(0, MAX_SCAN_CHARS).trim();
  if (!text) return { kind: 'empty' };
  if (/^BEGIN:VCARD/i.test(text)) {
    const contact = parseVCard(text);
    return hasContent(contact) ? { kind: 'contact', contact, format: 'vCard' } : { kind: 'text', text };
  }
  if (/^MECARD:/i.test(text)) {
    const contact = parseMeCard(text);
    return hasContent(contact) ? { kind: 'contact', contact, format: 'MeCard' } : { kind: 'text', text };
  }
  if (/^https?:\/\/\S+$/i.test(text)) {
    const url = safeHttpUrl(text);
    if (url) return { kind: 'url', url };
  }
  return { kind: 'text', text: cap(text, 2000) };
}

function hasContent(c) {
  return Boolean(c.fullName || c.preferredName || c.company || c.phones.length || c.emails.length || c.urls.length || c.address || c.note);
}

function unescapeValue(v) {
  return v.replace(/\\([\\,;nN:])/g, (m, ch) => (ch === 'n' || ch === 'N' ? '\n' : ch));
}

function splitUnescaped(v, sep) {
  const out = [];
  let cur = '';
  for (let i = 0; i < v.length; i += 1) {
    const ch = v[i];
    if (ch === '\\' && i + 1 < v.length) {
      cur += ch + v[i + 1];
      i += 1;
    } else if (ch === sep) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function decodeQuotedPrintable(v) {
  const bytes = [];
  const s = v.replace(/=\r?\n/g, '');
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === '=' && /^[0-9A-F]{2}$/i.test(s.slice(i + 1, i + 3))) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
    } else bytes.push(...new TextEncoder().encode(s[i]));
  }
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
  } catch {
    return v;
  }
}

function typeLabel(params, kind) {
  const types = params
    .filter((p) => /^TYPE=/i.test(p) || !p.includes('='))
    .flatMap((p) => p.replace(/^TYPE=/i, '').split(','))
    .map((x) => x.toUpperCase().replace(/"/g, ''));
  if (kind === 'TEL') {
    if (types.includes('CELL')) return 'Mobile';
    if (types.includes('WORK')) return 'Work';
    if (types.includes('HOME')) return 'Home';
    return 'Other';
  }
  if (kind === 'EMAIL') {
    if (types.includes('WORK')) return 'Work';
    if (types.includes('HOME')) return 'Personal';
    return 'Other';
  }
  return '';
}

export function parseVCard(text) {
  const c = emptyContact();
  const unfolded = text.replace(/\r\n[ \t]|\n[ \t]/g, '');
  const lines = unfolded.split(/\r\n|\n|\r/);
  const groupLabels = {};
  const entries = [];
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const head = line.slice(0, idx);
    let value = line.slice(idx + 1);
    const [nameWithGroup, ...params] = head.split(';');
    const dot = nameWithGroup.lastIndexOf('.');
    const group = dot > 0 ? nameWithGroup.slice(0, dot) : '';
    const name = (dot > 0 ? nameWithGroup.slice(dot + 1) : nameWithGroup).toUpperCase();
    if (params.some((p) => /ENCODING=QUOTED-PRINTABLE/i.test(p))) value = decodeQuotedPrintable(value);
    if (name === 'X-ABLABEL' && group) {
      groupLabels[group] = cap(unescapeValue(value).replace(/^_\$!<(.*)>!\$_$/, '$1'), 40);
      continue;
    }
    entries.push({ group, name, params, value });
  }

  for (const { group, name, params, value } of entries) {
    const plain = cap(unescapeValue(value).trim(), 500);
    switch (name) {
      case 'FN':
        c.fullName = c.fullName || cap(plain, 200);
        break;
      case 'N': {
        if (!c.fullName) {
          const [family = '', given = '', middle = '', prefix = '', suffix = ''] = splitUnescaped(value, ';').map((x) => unescapeValue(x).trim());
          c.fullName = cap([prefix, given, middle, family, suffix].filter(Boolean).join(' '), 200);
        }
        break;
      }
      case 'NICKNAME':
        c.preferredName = cap(plain, 200);
        break;
      case 'ORG':
        c.company = cap(unescapeValue(splitUnescaped(value, ';')[0] || '').trim(), 200);
        break;
      case 'TITLE':
        c.jobTitle = cap(plain, 200);
        break;
      case 'TEL':
        if (plain && c.phones.length < MAX_ITEMS) c.phones.push({ label: groupLabels[group] || typeLabel(params, 'TEL'), value: cap(plain.replace(/^tel:/i, ''), 40) });
        break;
      case 'EMAIL':
        if (plain && c.emails.length < MAX_ITEMS) c.emails.push({ label: typeLabel(params, 'EMAIL'), value: cap(plain, 200) });
        break;
      case 'URL':
      case 'X-SOCIALPROFILE': {
        const url = safeHttpUrl(plain);
        if (url && c.urls.length < MAX_ITEMS) {
          const typeParam = params.find((p) => /^TYPE=/i.test(p));
          const label = groupLabels[group] || (name === 'X-SOCIALPROFILE' && typeParam ? typeParam.slice(5) : 'Website');
          c.urls.push({ label: cap(label, 40), url });
        }
        break;
      }
      case 'ADR': {
        const [, , street = '', city = '', region = '', postcode = '', country = ''] = splitUnescaped(value, ';').map((x) => cap(unescapeValue(x).trim(), 200));
        if ([street, city, region, postcode, country].some(Boolean)) c.address = { street, city, region, postcode, country };
        break;
      }
      case 'BDAY': {
        const m = plain.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
        if (m) c.birthday = `${m[1]}-${m[2]}-${m[3]}`;
        break;
      }
      case 'NOTE':
        c.note = cap(plain, 1000);
        break;
      default:
        break; // PHOTO, KEY, and unknown properties are deliberately ignored
    }
  }
  return c;
}

export function parseMeCard(text) {
  const c = emptyContact();
  const body = text.replace(/^MECARD:/i, '');
  for (const part of splitUnescaped(body, ';')) {
    const idx = part.indexOf(':');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).toUpperCase();
    const value = cap(unescapeValue(part.slice(idx + 1)).trim(), 500);
    if (!value) continue;
    if (key === 'N') {
      const [family, given] = value.split(',').map((x) => x.trim());
      c.fullName = cap([given, family].filter(Boolean).join(' '), 200);
    } else if (key === 'NICKNAME') c.preferredName = cap(value, 200);
    else if (key === 'TEL' && c.phones.length < MAX_ITEMS) c.phones.push({ label: 'Mobile', value: cap(value, 40) });
    else if (key === 'EMAIL' && c.emails.length < MAX_ITEMS) c.emails.push({ label: 'Other', value: cap(value, 200) });
    else if (key === 'URL') {
      const url = safeHttpUrl(value);
      if (url) c.urls.push({ label: 'Website', url });
    } else if (key === 'ADR') c.address = { street: value, city: '', region: '', postcode: '', country: '' };
    else if (key === 'BDAY') {
      const m = value.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
      if (m) c.birthday = `${m[1]}-${m[2]}-${m[3]}`;
    } else if (key === 'NOTE') c.note = cap(value, 1000);
    else if (key === 'ORG') c.company = cap(value, 200);
  }
  return c;
}

export function vcardFileName(data) {
  const base = (data.fullName || data.preferredName || 'contact').replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/\s+/g, '-');
  return `${base || 'contact'}.vcf`;
}
