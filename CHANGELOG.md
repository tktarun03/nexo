# Changelog

All notable changes to NEXO. Newest first. Keep this in step with `RELEASES` in `src/version.js` and `version` in `package.json` (a test checks).

## 1.1.0 — 2026-11-09

- Bottom tab bar (Cards · Scan · Show QR · Profile · Settings); hides on task screens and while typing.
- Refresh button on Cards and "Check for updates" in Settings: installs a newer version if there is one, otherwise reloads saved data.
- Edit card and Details to share moved under the carousel; Show QR is the raised centre tab.
- Profile and Settings are now top-level tabs.
- Demo person renamed from Maya to Sara.

## 1.0.0 — 2026-11-09

First release.

- Photo identity cards (Personal, Professional, Social, Business, Custom) in a swipeable carousel.
- My Profile with multiple phones, emails and social profiles, address, birthday, bio and custom fields; saves automatically.
- Per-detail share switches and presets (Personal, Professional networking, Social, Custom); the QR updates as you toggle.
- Live preview of exactly what you share, plus what you don't.
- Standard vCard 3.0 QR codes made on the device; Save QR, Share contact, download .vcf, copy as text.
- QR scanner (native detector or bundled jsQR), scan from a photo, paste text; review before saving.
- Screen kept awake while showing a QR (where supported); native brightness adapter for a future Capacitor build.
- Offline PWA; JSON backup/restore; erase all data; self-check; version history; bottom notices with Undo.
- Demo mode with fictional data that is never written to the device database.
