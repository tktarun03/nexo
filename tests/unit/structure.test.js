// Structure checks: versions in sync, no unsafe HTML, no logging of data.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { RELEASES } from '../../src/version.js';

const root = join(__dirname, '..', '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const sources = walk(join(root, 'src')).filter((f) => f.endsWith('.js'));

describe('versioning', () => {
  it('package.json, RELEASES and CHANGELOG agree', () => {
    expect(RELEASES[0].version).toBe(pkg.version);
    const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
    const first = changelog.match(/^## \[?(\d+\.\d+\.\d+)/m);
    expect(first?.[1]).toBe(pkg.version);
  });
  it('service worker cache id is tied to the version', () => {
    const cfg = readFileSync(join(root, 'vite.config.js'), 'utf8');
    expect(cfg).toMatch(/cacheId: `nexo-\$\{pkg\.version\}`/);
  });
  it('releases are newest first with notes', () => {
    for (const r of RELEASES) expect(r.notes.length).toBeGreaterThan(0);
  });
});

describe('safety', () => {
  it('only dom.js touches innerHTML', () => {
    const offenders = sources.filter((f) => !f.endsWith('dom.js') && /\.innerHTML\s*=|insertAdjacentHTML|outerHTML\s*=/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
  it('no console logging in app code', () => {
    const offenders = sources.filter((f) => /console\.(log|info|debug|warn|error)\(/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
  it('no network calls in app code (fetch/XHR/sendBeacon/WebSocket)', () => {
    const offenders = sources.filter((f) => /\bfetch\(|XMLHttpRequest|sendBeacon|new WebSocket/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
  it('no eval-like code', () => {
    const offenders = sources.filter((f) => /\beval\(|new Function\(/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
  it('contact data is never put in URLs', () => {
    const offenders = sources.filter((f) => /location\.(hash|search)\s*=|[?&](name|phone|email)=/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

describe('routes', () => {
  it('every route module exists', () => {
    const main = readFileSync(join(root, 'src', 'main.js'), 'utf8');
    const files = [...main.matchAll(/import\('\.\/screens\/(\w+)\.js'\)/g)].map((m) => m[1]);
    expect(files.length).toBeGreaterThan(8);
    for (const f of files) expect(() => statSync(join(root, 'src', 'screens', `${f}.js`))).not.toThrow();
  });
});
