# Roadmap

## Next

- Swap in real demo photos (owner is sending 3–4 he owns) → `public/images/demo/`, `staticPhoto` in `src/data/demo.js`.
- Real-device pass on iPhone (Safari tab + Home Screen app) and an Android phone: camera scan, wake lock, `.vcf` save, share sheet, cropper pinch.
- Get 3–5 real users before adding features.
- Card reordering (drag in a sheet).
- Optional app lock (passcode) if users ask for it.

## Later

- Tamil translation (strings already go through `t()`).
- Capacitor build with real brightness control (adapter already in place).
- Optional revocable online links (see `docs/ARCHITECTURE.md`).
- “Recently received” list for scanned contacts (opt-in, local only).

## Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-11-09 | Vite + vanilla ES modules, no framework | Brief asked for it; small bundle, easy to maintain. Deviates from the “no build step” default in app-essentials, which the brief overrides. |
| 2026-11-09 | No password / encryption at launch | Owner chose it: matches “no login”; the data is what users choose to share anyway. Revisit as an optional passcode. |
| 2026-11-09 | vCard 3.0 in the QR, photo only in `.vcf` | Best camera/Contacts support; photos would make QR codes unscannable. |
| 2026-11-09 | New profile details default OFF on custom-shared cards | Privacy first: adding a home address must never silently start sharing it. |
| 2026-11-09 | Asset cache-busting via Vite content hashes, not `?v=` | Vite fingerprints every file; the SW cache id and in-app version still equal the release (tested). |
| 2026-11-09 | Demo runs on an in-memory store | Guarantees demo data can't mix with real data. |
| 2026-11-09 | English only at launch | Owner chose it; i18n table ready for Tamil. |
| 2026-11-09 | No real hardware brightness on the web | No browser API exists; wake lock + white surface instead, native adapter for later. |
