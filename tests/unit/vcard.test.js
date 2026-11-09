import { describe, it, expect } from 'vitest';
import { encodeVCard, parseScanned, parseVCard, foldLine, escapeValue, MAX_SCAN_CHARS } from '../../src/services/VCard.js';
import { emptyContact } from '../../src/services/VCard.js';

const sample = {
  ...emptyContact(),
  fullName: 'Maya Rao',
  preferredName: 'Maya',
  jobTitle: 'Designer, Senior',
  company: 'Lumen; Studio',
  phones: [
    { label: 'Mobile', value: '+1 202 555 0143' },
    { label: 'WhatsApp', value: '+1 202 555 0144' },
  ],
  emails: [{ label: 'Work', value: 'maya@example.com' }],
  urls: [
    { label: 'Website', url: 'https://maya.example.com/' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/mayarao' },
  ],
  address: { street: '12 Lake Rd', city: 'Springfield', region: '', postcode: '00000', country: 'Example' },
  birthday: '1994-04-18',
  note: 'Line one\nPronouns: she/her',
};

describe('encodeVCard', () => {
  it('writes a vCard 3.0 that starts and ends correctly', () => {
    const v = encodeVCard(sample);
    expect(v.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n')).toBe(true);
    expect(v.endsWith('END:VCARD')).toBe(true);
    expect(v).toContain('N:Rao;Maya;;;');
    expect(v).toContain('FN:Maya Rao');
    expect(v).toContain('ORG:Lumen\\; Studio');
    expect(v).toContain('TITLE:Designer\\, Senior');
    expect(v).toContain('TEL;TYPE=CELL:+1 202 555 0143');
    expect(v).toMatch(/item\d\.TEL:\+1 202 555 0144\r\nitem\d\.X-ABLabel:WhatsApp/);
    expect(v).toContain('BDAY:1994-04-18');
    expect(v).toContain('NOTE:Line one\\nPronouns: she/her');
  });

  it('escapes newlines so a value cannot inject new properties', () => {
    const v = encodeVCard({ ...emptyContact(), fullName: 'Eve\r\nTEL:+000 evil' });
    expect(v.split('\r\n').filter((l) => l.startsWith('TEL'))).toHaveLength(0);
  });

  it('folds long lines at 75 octets for files', () => {
    const line = `NOTE:${'x'.repeat(200)}`;
    const folded = foldLine(line);
    for (const part of folded.split('\r\n')) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(line);
  });

  it('escapeValue handles backslash, comma, semicolon', () => {
    expect(escapeValue('a\\b,c;d')).toBe('a\\\\b\\,c\\;d');
  });
});

describe('round trip', () => {
  it('parse(encode(x)) gives back the same contact', () => {
    const res = parseScanned(encodeVCard(sample));
    expect(res.kind).toBe('contact');
    const c = res.contact;
    expect(c.fullName).toBe('Maya Rao');
    expect(c.preferredName).toBe('Maya');
    expect(c.company).toBe('Lumen; Studio');
    expect(c.jobTitle).toBe('Designer, Senior');
    expect(c.phones).toEqual([{ label: 'Mobile', value: '+1 202 555 0143' }, { label: 'WhatsApp', value: '+1 202 555 0144' }]);
    expect(c.emails).toEqual([{ label: 'Work', value: 'maya@example.com' }]);
    expect(c.urls.map((u) => u.label)).toEqual(['Website', 'LinkedIn']);
    expect(c.address.city).toBe('Springfield');
    expect(c.birthday).toBe('1994-04-18');
    expect(c.note).toBe('Line one\nPronouns: she/her');
  });

  it('round trips folded file output and Unicode names', () => {
    const data = { ...sample, fullName: 'அருண் குமார்', note: 'நன்றி '.repeat(30) };
    const c = parseScanned(encodeVCard(data, { fold: true })).contact;
    expect(c.fullName).toBe('அருண் குமார்');
    expect(c.note).toBe(data.note.trim());
  });
});

describe('parsing untrusted input', () => {
  it('reads common vCard variants (v2.1 quoted-printable, Apple labels, social profiles)', () => {
    const text = [
      'BEGIN:VCARD', 'VERSION:2.1',
      'N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:M=C3=BCller;J=C3=B6rg',
      'TEL;WORK;VOICE:+49 30 1234',
      'item1.EMAIL;type=INTERNET:jorg@example.com', 'item1.X-ABLabel:_$!<Other>!$_',
      'X-SOCIALPROFILE;type=twitter:https://x.com/jorg',
      'END:VCARD',
    ].join('\r\n');
    const c = parseVCard(text);
    expect(c.fullName).toBe('Jörg Müller');
    expect(c.phones[0]).toEqual({ label: 'Work', value: '+49 30 1234' });
    expect(c.emails[0].value).toBe('jorg@example.com');
    expect(c.urls[0]).toEqual({ label: 'twitter', url: 'https://x.com/jorg' });
  });

  it('drops javascript:, data: and other non-http links', () => {
    const text = ['BEGIN:VCARD', 'VERSION:3.0', 'FN:X', 'URL:javascript:alert(1)', 'URL:data:text/html,<b>', 'URL:https://ok.example.com', 'END:VCARD'].join('\n');
    const c = parseVCard(text);
    expect(c.urls).toEqual([{ label: 'Website', url: 'https://ok.example.com/' }]);
  });

  it('keeps markup as plain text (rendering uses textContent)', () => {
    const c = parseScanned('BEGIN:VCARD\nVERSION:3.0\nFN:<img src=x onerror=alert(1)>\nEND:VCARD').contact;
    expect(c.fullName).toBe('<img src=x onerror=alert(1)>');
  });

  it('caps sizes and list lengths', () => {
    const many = Array.from({ length: 200 }, (_, i) => `TEL:+1 555 ${i}`).join('\n');
    const c = parseScanned(`BEGIN:VCARD\nVERSION:3.0\nFN:${'A'.repeat(5000)}\n${many}\nEND:VCARD`).contact;
    expect(c.fullName.length).toBeLessThanOrEqual(200);
    expect(c.phones.length).toBeLessThanOrEqual(20);
    expect(MAX_SCAN_CHARS).toBeLessThanOrEqual(8000);
  });

  it('ignores PHOTO data in scanned cards', () => {
    const c = parseVCard('BEGIN:VCARD\nVERSION:3.0\nFN:P\nPHOTO;VALUE=URI:https://tracker.example.com/p.png\nEND:VCARD');
    expect(JSON.stringify(c)).not.toContain('tracker');
  });

  it('parses MeCard', () => {
    const res = parseScanned('MECARD:N:Rao,Maya;TEL:+12025550143;EMAIL:maya@example.com;URL:maya.example.com;NOTE:Hi\\; there;;');
    expect(res.kind).toBe('contact');
    expect(res.contact.fullName).toBe('Maya Rao');
    expect(res.contact.phones[0].value).toBe('+12025550143');
    expect(res.contact.urls[0].url).toBe('https://maya.example.com/');
    expect(res.contact.note).toBe('Hi; there');
  });

  it('classifies links and plain text', () => {
    expect(parseScanned('https://example.com/x')).toEqual({ kind: 'url', url: 'https://example.com/x' });
    expect(parseScanned('hello world').kind).toBe('text');
    expect(parseScanned('   ').kind).toBe('empty');
    expect(parseScanned('BEGIN:VCARD\nVERSION:3.0\nEND:VCARD').kind).toBe('text');
  });
});
