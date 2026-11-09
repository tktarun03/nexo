import { describe, it, expect } from 'vitest';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { analyse, toSVG } from '../../src/services/QRService.js';
import { encodeVCard, parseScanned } from '../../src/services/VCard.js';
import { buildSharePayload, migrateProfile } from '../../src/services/ContactService.js';

/** Render a QR matrix to RGBA pixels (no canvas needed) and decode it with jsQR. */
function decode(text, ecl = 'M', scale = 4) {
  const qr = QRCode.create(text, { errorCorrectionLevel: ecl });
  const n = qr.modules.size;
  const margin = 4;
  const size = (n + margin * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (!qr.modules.get(r, c)) continue;
      for (let y = 0; y < scale; y += 1) {
        for (let x = 0; x < scale; x += 1) {
          const i = (((r + margin) * scale + y) * size + (c + margin) * scale + x) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }
  }
  return jsQR(data, size, size)?.data ?? null;
}

const profile = migrateProfile({
  fullName: 'Arun Kumar',
  jobTitle: 'Founder',
  company: 'Beyond The Obvious',
  phones: [{ id: 'p', label: 'Mobile', value: '+974 5555 0101' }],
  emails: [{ id: 'e', label: 'Work', value: 'arun@example.com' }],
  address: { street: 'Secret Street 1', city: 'Doha', region: '', postcode: '', country: 'Qatar' },
  socials: [{ id: 's', network: 'linkedin', value: 'arunkumar' }],
});

describe('QR encode → decode', () => {
  it('a selected-fields vCard survives QR encoding and decoding byte for byte', () => {
    const sel = { fullName: true, jobTitle: true, company: true, 'phone:p': true, 'email:e': true, 'social:s': true };
    const text = encodeVCard(buildSharePayload(profile, sel));
    const info = analyse(text);
    expect(info.ok).toBe(true);
    const decoded = decode(text, info.ecl);
    expect(decoded).toBe(text);
    const back = parseScanned(decoded);
    expect(back.contact.fullName).toBe('Arun Kumar');
    expect(back.contact.phones[0].value).toBe('+974 5555 0101');
    expect(decoded).not.toContain('Secret Street'); // address was not selected
  });

  it('handles non-Latin text', () => {
    const text = encodeVCard(buildSharePayload(migrateProfile({ fullName: 'அருண் குமார்' }), { fullName: true }));
    expect(decode(text)).toBe(text);
  });

  it('typical cards stay in the easy-to-scan range', () => {
    const text = encodeVCard(buildSharePayload(profile, { fullName: true, 'phone:p': true, 'email:e': true }));
    expect(analyse(text).level).toBe('good');
  });

  it('flags dense and impossible payloads', () => {
    expect(analyse('x'.repeat(900)).level).toMatch(/dense|too-dense/);
    expect(analyse('x'.repeat(5000))).toMatchObject({ ok: false, level: 'too-large' });
  });

  it('SVG output is black on white with a quiet zone and no script', async () => {
    const svg = await toSVG('hello');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('#ffffff');
    expect(svg).toContain('#000000');
    expect(svg).not.toMatch(/<script/i);
    const n = QRCode.create('hello', { errorCorrectionLevel: 'M' }).modules.size;
    expect(svg).toContain(`viewBox="0 0 ${n + 8} ${n + 8}"`);
  });
});
