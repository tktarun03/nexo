// Persistence. IndexedDB (via idb) holds the profile, cards and photos.
// A MemoryStore with the same interface backs Demo mode, so demo data can never
// touch real data. Writes are queued so they land in order.

import { openDB } from 'idb';
import { migrateProfile, migrateCard, emptyProfile } from './ContactService.js';

export const DB_NAME = 'nexo';
export const DB_VERSION = 1;

let errorHandler = () => {};
/** Called with the Error whenever a write fails (the app shows "Couldn't save" + Back up). */
export function onStorageError(fn) {
  errorHandler = fn;
}

function queue() {
  let tail = Promise.resolve();
  return (task) => {
    const run = tail.then(task, task);
    tail = run.catch(() => {});
    return run;
  };
}

export class IdbStore {
  constructor(name = DB_NAME) {
    this.name = name;
    this.kind = 'device';
    this.enqueue = queue();
    this.dbPromise = null;
  }

  db() {
    if (!this.dbPromise) {
      this.dbPromise = openDB(this.name, DB_VERSION, {
        upgrade(db, oldVersion) {
          if (oldVersion < 1) {
            db.createObjectStore('profile', { keyPath: 'id' });
            db.createObjectStore('cards', { keyPath: 'id' });
            db.createObjectStore('photos', { keyPath: 'id' });
          }
        },
        blocked() {
          /* another tab holds an old version; it will close on its own */
        },
      });
    }
    return this.dbPromise;
  }

  async write(fn) {
    return this.enqueue(async () => {
      try {
        return await fn(await this.db());
      } catch (err) {
        errorHandler(err);
        throw err;
      }
    });
  }

  async getProfile() {
    const raw = await (await this.db()).get('profile', 'me');
    return raw ? migrateProfile(raw) : null;
  }

  async saveProfile(profile) {
    const p = migrateProfile({ ...profile, updatedAt: Date.now() });
    await this.write((db) => db.put('profile', p));
    return p;
  }

  async listCards() {
    const all = await (await this.db()).getAll('cards');
    return all.map((c, i) => migrateCard(c, i)).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
  }

  async saveCard(card) {
    const c = migrateCard({ ...card, updatedAt: Date.now() });
    await this.write((db) => db.put('cards', c));
    return c;
  }

  async deleteCard(id) {
    await this.write((db) => db.delete('cards', id));
  }

  async getPhoto(id) {
    if (!id) return null;
    return (await (await this.db()).get('photos', id)) || null;
  }

  async listPhotos() {
    return (await this.db()).getAll('photos');
  }

  async savePhoto(photo) {
    await this.write((db) => db.put('photos', photo));
    return photo;
  }

  async deletePhoto(id) {
    if (!id) return;
    await this.write((db) => db.delete('photos', id));
  }

  /** Replace everything in one transaction (restore from backup). */
  async replaceAll({ profile, cards, photos }) {
    await this.write(async (db) => {
      const tx = db.transaction(['profile', 'cards', 'photos'], 'readwrite');
      await Promise.all([tx.objectStore('profile').clear(), tx.objectStore('cards').clear(), tx.objectStore('photos').clear()]);
      if (profile) await tx.objectStore('profile').put(migrateProfile(profile));
      for (const [i, c] of cards.entries()) await tx.objectStore('cards').put(migrateCard(c, i));
      for (const ph of photos) await tx.objectStore('photos').put(ph);
      await tx.done;
    });
  }

  async eraseAll() {
    await this.write(async (db) => {
      const tx = db.transaction(['profile', 'cards', 'photos'], 'readwrite');
      await Promise.all([tx.objectStore('profile').clear(), tx.objectStore('cards').clear(), tx.objectStore('photos').clear()]);
      await tx.done;
    });
  }

  /** Self-check: write, read back and delete a probe record. */
  async probe() {
    const db = await this.db();
    const id = `__probe_${Date.now()}`;
    await db.put('photos', { id, type: 'text/plain', buffer: new ArrayBuffer(4) });
    const back = await db.get('photos', id);
    await db.delete('photos', id);
    return Boolean(back);
  }
}

/** In-memory store for Demo mode. Same interface, nothing persisted. */
export class MemoryStore {
  constructor(seed = {}) {
    this.kind = 'demo';
    this.profile = seed.profile ? migrateProfile(seed.profile) : migrateProfile(emptyProfile());
    this.cards = new Map((seed.cards || []).map((c, i) => [c.id, migrateCard(c, i)]));
    this.photos = new Map((seed.photos || []).map((p) => [p.id, p]));
  }
  async getProfile() {
    return migrateProfile(this.profile);
  }
  async saveProfile(p) {
    this.profile = migrateProfile({ ...p, updatedAt: Date.now() });
    return this.profile;
  }
  async listCards() {
    return [...this.cards.values()].sort((a, b) => a.order - b.order);
  }
  async saveCard(c) {
    const card = migrateCard({ ...c, updatedAt: Date.now() });
    this.cards.set(card.id, card);
    return card;
  }
  async deleteCard(id) {
    this.cards.delete(id);
  }
  async getPhoto(id) {
    return this.photos.get(id) || null;
  }
  async listPhotos() {
    return [...this.photos.values()];
  }
  async savePhoto(p) {
    this.photos.set(p.id, p);
    return p;
  }
  async deletePhoto(id) {
    this.photos.delete(id);
  }
  async replaceAll() {
    throw new Error('Restore is not available in demo mode');
  }
  async eraseAll() {
    this.cards.clear();
    this.photos.clear();
  }
  async probe() {
    return true;
  }
}

/** Ask the browser not to evict our storage (best effort; Safari may ignore). */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return Boolean(await navigator.storage?.persist?.());
  } catch {
    return false;
  }
}
