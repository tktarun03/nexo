# AGENTS.md — working on NEXO

NEXO (“Your identity. Your rules.”) is a privacy-first, offline digital contact wallet: photo identity cards, per-detail share switches, and vCard QR codes generated on the device. No backend, no account, no analytics. Live at <https://tktarun03.github.io/nexo/>.

## Golden rules

1. **Privacy first.** Only details whose switch is literally `true` may reach a QR, `.vcf`, preview or share text. All of them go through `buildSharePayload()` (explicit allowlist) in `src/services/ContactService.js`. Never spread or copy the profile object into an output.
2. **No network.** App code must not call `fetch`, XHR, beacons or sockets (a test enforces it). No analytics, no CDNs at runtime — every library is bundled.
3. **No unsafe HTML.** Build DOM with `h()` from `src/utils/dom.js`; strings become text nodes. Only `setTrustedSVG()` (app-generated SVG) touches `innerHTML` (a test enforces it).
4. **Never log contact data.** No `console.*` in `src/` (a test enforces it).
5. **Demo data stays in memory.** Demo mode uses `MemoryStore`; it never touches IndexedDB.
6. **Migrations.** Every saved field gets a default in `migrateProfile()` / `migrateCard()` / `migrateSettings()`. Never rename or remove a field without a migration.
7. **Mobile Safari first.** Inputs ≥16px, tap targets ≥44px, no text <11px, safe areas, no `100vh` on full screens (flex + inner scroll instead).
8. **Every data change shows a notice** via `toast()` (`src/components/Toast.js`), with Undo when it can safely be put back. No Undo for restore or erase.
9. **All UI text through `t()`** (`src/utils/i18n.js`); names and numbers as `{placeholders}`.
10. **Honest brightness.** Browsers can't change hardware brightness; don't claim they do (see `BrightnessService.js`).

## Repo map

```
index.html                 shell, CSP, splash (can't get stuck), theme pre-paint
vite.config.js             Vite + vite-plugin-pwa (manifest, workbox, cacheId = version)
src/main.js                boot, routes, ctx (go/back/closeTo), update + backup notices
src/router.js              hash router, history-aware sheets, scroll restoration
src/state.js               active store (device|demo), cached profile/cards/photos
src/version.js             VERSION + RELEASES (in-app version history)
src/data/demo.js           fictional demo profile/cards (memory only)
src/services/
  ContactService.js        field catalogue, presets, selection, allowlist payload  ← privacy core
  VCard.js                 vCard 3.0 encoder, defensive vCard/MeCard parser
  QRService.js             QR SVG/PNG (qrcode), readability analysis, jsQR decode
  StorageService.js        IdbStore (idb) + MemoryStore, ordered writes, error hook
  PhotoService.js          photo blobs, tint sampling, vCard photo
  BackupService.js         JSON export/import with validation
  ShareService.js          Web Share → download → clipboard fallbacks
  BrightnessService.js     wake lock + optional Capacitor brightness adapter
  SettingsService.js       localStorage settings (theme, text size, counters)
  PwaService.js            SW registration, standalone / iOS detection
  SelfCheck.js             on-device checks (Settings → Run self-check)
src/components/            Icon, Toast, BottomSheet, IdentityCard, CardCarousel, PhotoCropper, Controls, Logo
src/screens/               welcome, onboarding, home, checklist, profile, card, share, review, qr, scan, settings, about
src/styles/                tokens, global, cards, screens, animations
tests/unit/                vitest: privacy, vcard, qr, storage/backup, structure
tests/e2e/                 Playwright flows at 375×667, 390×844, 430×932
scripts/make-icons.py      builds PWA icons from brand/app-icon.png
brand/                     original logo artwork
```

## Where things are

| Need to change… | Go to |
|---|---|
| What a preset switches on | `presetIncludes()` in `ContactService.js` |
| What a field looks like in the QR | `encodeVCard()` in `VCard.js` |
| Add a profile field | `emptyProfile()`, `migrateProfile()`, `listShareItems()`, `buildSharePayload()`, `payloadRows()`, profile screen, privacy test |
| Card look / scenes | `IdentityCard.js`, `cards.css` (`.scene-*`), `SCENES` |
| Notices | `components/Toast.js` |
| Version + release notes | `package.json`, `src/version.js`, `CHANGELOG.md` |
| Demo photos | drop files in `public/images/demo/`, set `staticPhoto` in `src/data/demo.js` |

## Test and run

```bash
npm install
npm run dev          # http://localhost:5173 (also on your LAN with --host)
npm test             # unit tests (vitest)
npm run test:e2e     # browser flows (Playwright; builds + previews automatically)
npm run build        # production build to dist/
```

In a sandbox with a preinstalled Chromium: `PW_CHROMIUM=/path/to/chrome npm run test:e2e`.

## Deploy

Push to `main`. GitHub Actions (`.github/workflows/ci.yml`) runs unit + browser tests, builds, and only then deploys `dist/` to GitHub Pages. Check both jobs succeeded before reporting a release.

## Sharp edges

- **iPhone Home Screen storage is separate from Safari.** Data entered in Safari is not in the installed app. Use backup/restore to move it.
- **Safari may evict storage** for sites not visited for ~7 days (not for Home Screen apps). The app asks for persistent storage and reminds users to back up.
- **Camera needs a secure context** (HTTPS or `localhost`). On a phone over plain LAN HTTP, scanning falls back to “scan from a photo”.
- **Wake Lock** is not available in every browser or in Low Power Mode; the QR screen says so honestly.
- **QR density.** vCards above ~version 15 get dense; above 25 the screen offers text / `.vcf` fallbacks.
- **Notices pause while hovered.** In Playwright, move the mouse away after a click that spawns one.
