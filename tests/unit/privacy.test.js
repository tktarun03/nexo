// The core promise: only switched-on details ever reach the QR / vCard.
import { describe, it, expect } from 'vitest';
import {
  migrateProfile, migrateCard, listShareItems, resolveSelection, selectionForPreset, buildSharePayload, payloadIsEmpty, payloadRows,
} from '../../src/services/ContactService.js';
import { encodeVCard } from '../../src/services/VCard.js';

/** Profile where every value carries a unique marker, so leaks are easy to spot. */
function markedProfile() {
  return migrateProfile({
    fullName: 'Name MK_FULLNAME',
    preferredName: 'MK_PREFERRED',
    photoId: 'ph_1',
    jobTitle: 'MK_JOBTITLE',
    company: 'MK_COMPANY',
    phones: [
      { id: 'p1', label: 'Mobile', value: '+1 555 0101 MK_PHONE1' },
      { id: 'p2', label: 'Home', value: '+1 555 0102 MK_PHONE2' },
    ],
    whatsapp: '+1 555 0103 MK_WHATSAPP',
    emails: [
      { id: 'e1', label: 'Personal', value: 'mk_email1@example.com' },
      { id: 'e2', label: 'Work', value: 'mk_email2@example.com' },
    ],
    website: 'mk-website.example.com',
    socials: [
      { id: 's1', network: 'linkedin', value: 'mk_linkedin' },
      { id: 's2', network: 'instagram', value: 'mk_instagram' },
    ],
    address: { street: 'MK_STREET', city: 'MK_CITY', region: '', postcode: '', country: '' },
    birthday: '1990-01-02',
    bio: 'MK_BIO',
    custom: [{ id: 'c1', label: 'Pronouns', value: 'MK_CUSTOM' }],
  });
}

const MARKERS = {
  fullName: ['MK_FULLNAME'],
  preferredName: ['MK_PREFERRED'],
  jobTitle: ['MK_JOBTITLE'],
  company: ['MK_COMPANY'],
  'phone:p1': ['MK_PHONE1'],
  'phone:p2': ['MK_PHONE2'],
  whatsapp: ['MK_WHATSAPP'],
  'email:e1': ['mk_email1'],
  'email:e2': ['mk_email2'],
  website: ['mk-website'],
  'social:s1': ['mk_linkedin'],
  'social:s2': ['mk_instagram'],
  address: ['MK_STREET', 'MK_CITY'],
  birthday: ['1990-01-02'],
  bio: ['MK_BIO'],
  'custom:c1': ['MK_CUSTOM'],
};
const ALL_MARKERS = Object.values(MARKERS).flat();

describe('share items', () => {
  it('lists one item per filled value and nothing for empty ones', () => {
    const p = markedProfile();
    const keys = listShareItems(p, { hasPhoto: true }).map((i) => i.key);
    expect(keys).toEqual(expect.arrayContaining([...Object.keys(MARKERS), 'photo']));
    const empty = listShareItems(migrateProfile({ fullName: 'Only Name' }));
    expect(empty.map((i) => i.key)).toEqual(['fullName']);
  });
});

describe('buildSharePayload allowlist', () => {
  it('produces an empty payload when nothing is selected', () => {
    const data = buildSharePayload(markedProfile(), {});
    expect(payloadIsEmpty(data)).toBe(true);
    const text = encodeVCard(data);
    for (const m of ALL_MARKERS) expect(text).not.toContain(m);
  });

  for (const [key, markers] of Object.entries(MARKERS)) {
    it(`selecting only "${key}" exposes only that value`, () => {
      const data = buildSharePayload(markedProfile(), { [key]: true });
      const text = encodeVCard(data) + JSON.stringify(data);
      for (const m of markers) expect(text).toContain(m);
      for (const m of ALL_MARKERS.filter((x) => !markers.includes(x))) expect(text).not.toContain(m);
    });
  }

  it('treats anything but literal true as off', () => {
    const data = buildSharePayload(markedProfile(), { fullName: 'yes', 'phone:p1': 1, company: null, bio: undefined });
    expect(payloadIsEmpty(data)).toBe(true);
  });

  it('never copies internal ids, the photo id or unknown profile keys', () => {
    const p = { ...markedProfile(), secretExtra: 'MK_EXTRA' };
    const all = Object.fromEntries(Object.keys(MARKERS).map((k) => [k, true]));
    const json = JSON.stringify(buildSharePayload(p, { ...all, photo: true }));
    expect(json).not.toContain('MK_EXTRA');
    expect(json).not.toContain('ph_1');
    expect(json).not.toMatch(/"id"/);
    expect(json).not.toContain('"p1"');
  });

  it('puts the photo only behind a flag (never pixels in the QR text)', () => {
    const data = buildSharePayload(markedProfile(), { photo: true, fullName: true });
    expect(data.includePhoto).toBe(true);
    expect(encodeVCard(data)).not.toContain('PHOTO');
  });

  it('preview rows are built from the same payload', () => {
    const data = buildSharePayload(markedProfile(), { fullName: true, 'email:e2': true });
    const rows = payloadRows(data);
    expect(rows.map((r) => r.value)).toEqual(['Name MK_FULLNAME', 'mk_email2@example.com']);
  });
});

describe('selection rules', () => {
  it('new profile items default to OFF on a custom card', () => {
    const p = markedProfile();
    const card = migrateCard({ id: 'c', type: 'custom', preset: 'custom', shareFields: { fullName: true } });
    const sel = resolveSelection(card, p, { hasPhoto: true });
    expect(sel.fullName).toBe(true);
    for (const [k, v] of Object.entries(sel)) if (k !== 'fullName') expect(v).toBe(false);
  });

  it('saved switches win over the preset', () => {
    const p = markedProfile();
    const card = migrateCard({ id: 'c', type: 'professional', preset: 'professional', shareFields: { 'email:e2': false, birthday: true } });
    const sel = resolveSelection(card, p);
    expect(sel['email:e2']).toBe(false);
    expect(sel.birthday).toBe(true);
    expect(sel.company).toBe(true); // from the preset
  });

  it('professional preset shares work details, not home address or birthday', () => {
    const sel = selectionForPreset('professional', markedProfile());
    expect(sel.jobTitle && sel.company && sel['email:e2'] && sel['social:s1']).toBe(true);
    expect(sel.address).toBe(false);
    expect(sel.birthday).toBe(false);
    expect(sel['email:e1']).toBe(false); // has a work email, so personal stays off
    expect(sel['phone:p2']).toBe(false); // home phone
    expect(sel['social:s2']).toBe(false); // instagram
  });

  it('personal preset keeps address and work email private', () => {
    const sel = selectionForPreset('personal', markedProfile());
    expect(sel.address).toBe(false);
    expect(sel['email:e2']).toBe(false);
    expect(sel.whatsapp && sel['social:s2'] && sel.birthday).toBe(true);
  });

  it('social preset shares profiles only', () => {
    const sel = selectionForPreset('social', markedProfile());
    expect(sel['social:s1'] && sel['social:s2']).toBe(true);
    expect(sel['phone:p1'] || sel['email:e1'] || sel.address).toBe(false);
  });
});
