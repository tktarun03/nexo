import { describe, it, expect, beforeEach } from 'vitest';
import { IdbStore, MemoryStore } from '../../src/services/StorageService.js';
import { migrateProfile, migrateCard } from '../../src/services/ContactService.js';
import { buildBackup, parseBackup } from '../../src/services/BackupService.js';
import { migrateSettings } from '../../src/services/SettingsService.js';

let n = 0;
const freshName = () => `nexo-test-${Date.now()}-${(n += 1)}`;

describe('IndexedDB persistence', () => {
  let name;
  beforeEach(() => {
    name = freshName();
  });

  it('profile, cards and photos survive a "restart" (new store instance)', async () => {
    const a = new IdbStore(name);
    await a.saveProfile({ fullName: 'Arun', phones: [{ id: 'p', label: 'Mobile', value: '+974 1' }] });
    await a.saveCard({ id: 'c1', type: 'professional', title: 'Work', order: 1, shareFields: { fullName: true } });
    await a.saveCard({ id: 'c0', type: 'personal', title: 'Me', order: 0 });
    await a.savePhoto({ id: 'ph', type: 'image/jpeg', buffer: new Uint8Array([1, 2, 3]).buffer, tint: '#112233' });

    const b = new IdbStore(name);
    const p = await b.getProfile();
    expect(p.fullName).toBe('Arun');
    expect(p.phones[0].value).toBe('+974 1');
    const cards = await b.listCards();
    expect(cards.map((c) => c.id)).toEqual(['c0', 'c1']); // sorted by order
    expect(cards[1].shareFields).toEqual({ fullName: true });
    const ph = await b.getPhoto('ph');
    expect(new Uint8Array(ph.buffer)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('deletes cards and erases everything', async () => {
    const s = new IdbStore(name);
    await s.saveProfile({ fullName: 'X' });
    await s.saveCard({ id: 'c1', type: 'personal' });
    await s.deleteCard('c1');
    expect(await s.listCards()).toEqual([]);
    await s.eraseAll();
    expect(await s.getProfile()).toBeNull();
  });

  it('writes land in order', async () => {
    const s = new IdbStore(name);
    await Promise.all(Array.from({ length: 20 }, (_, i) => s.saveProfile({ fullName: `v${i}` })));
    expect((await s.getProfile()).fullName).toBe('v19');
  });

  it('probe works', async () => {
    expect(await new IdbStore(name).probe()).toBe(true);
  });
});

describe('migrations give every field a default', () => {
  it('profile', () => {
    const p = migrateProfile({ fullName: 'A', phones: [{ value: '1' }], address: null, unknown: 1 });
    expect(p.phones[0]).toMatchObject({ label: 'Mobile', value: '1' });
    expect(p.phones[0].id).toBeTruthy();
    expect(p.address).toEqual({ street: '', city: '', region: '', postcode: '', country: '' });
    expect(p.emails).toEqual([]);
    expect(p.birthday).toBe('');
  });
  it('card', () => {
    const c = migrateCard({ type: 'nope', shareFields: { ok: true, bad: 'yes', 'x y': true }, scene: 'evil' });
    expect(c.type).toBe('custom');
    expect(c.shareFields).toEqual({ ok: true });
    expect(c.scene).toBe('sky');
    expect(c.photoMode).toBe('auto');
    expect(c.staticPhoto).toBe('');
  });
  it('settings', () => {
    expect(migrateSettings({ theme: 'neon', textSize: 'huge', shareCount: 'x' })).toMatchObject({ theme: 'system', textSize: 'default', shareCount: 0 });
  });
});

describe('demo store is separate', () => {
  it('memory store writes never reach IndexedDB', async () => {
    const name = freshName();
    const real = new IdbStore(name);
    await real.saveProfile({ fullName: 'Real' });
    const demo = new MemoryStore({ profile: { fullName: 'Demo' } });
    await demo.saveProfile({ fullName: 'Changed in demo' });
    await demo.saveCard({ id: 'd', type: 'social' });
    expect((await real.getProfile()).fullName).toBe('Real');
    expect(await real.listCards()).toEqual([]);
    await expect(demo.replaceAll({})).rejects.toThrow();
  });
});

describe('backup', () => {
  it('round trips profile, cards and photos', async () => {
    const s = new MemoryStore({
      profile: { fullName: 'Arun', photoId: 'ph' },
      cards: [{ id: 'c', type: 'personal', photoId: 'ph' }],
      photos: [{ id: 'ph', type: 'image/jpeg', buffer: new Uint8Array([9, 8, 7]).buffer, tint: '#000000', width: 3, height: 1 }],
    });
    const json = JSON.stringify(await buildBackup(s));
    const back = parseBackup(json);
    expect(back.profile.fullName).toBe('Arun');
    expect(back.cards[0].photoId).toBe('ph');
    expect(new Uint8Array(back.photos[0].buffer)).toEqual(new Uint8Array([9, 8, 7]));

    const restored = new IdbStore(freshName());
    await restored.replaceAll(back);
    expect((await restored.getProfile()).fullName).toBe('Arun');
    expect((await restored.listCards()).length).toBe(1);
  });

  it('rejects files that are not NEXO backups', () => {
    expect(() => parseBackup('not json')).toThrow(/valid JSON/);
    expect(() => parseBackup('{"app":"other"}')).toThrow(/not a NEXO backup/);
    expect(() => parseBackup('{"app":"nexo","format":99}')).toThrow(/newer/);
  });

  it('drops bad photos and dangling photo references', () => {
    const back = parseBackup(JSON.stringify({
      app: 'nexo',
      format: 1,
      profile: { fullName: 'A', photoId: 'missing' },
      cards: [{ id: 'c', type: 'personal', photoId: 'svg' }],
      photos: [{ id: 'svg', type: 'image/svg+xml', data: 'PHN2Zz4=' }, { id: '../x', type: 'image/png', data: 'AA==' }],
    }));
    expect(back.photos).toEqual([]);
    expect(back.profile.photoId).toBeNull();
    expect(back.cards[0].photoId).toBeNull();
  });
});
