# NEXO architecture

## Principles

My identity. My device. My sharing rules. Everything runs in the browser; there is no server component in the MVP.

## Layers

```
screens/      UI per route (render(ctx, params) → { el, mounted?, destroy?, title })
components/   reusable UI (cards, carousel, sheets, notices, cropper)
state.js      active store + cached profile / cards / photos
services/     pure logic and platform adapters (no DOM rendering)
utils/        dom builder, i18n, helpers
```

Routing is hash-based (`#/home`, `#/share/:id`, …) so GitHub Pages needs no rewrites. Bottom sheets push a history entry so the Back gesture closes them first. Screens are lazy-loaded modules.

## Data model

IndexedDB database `nexo`, version 1, three object stores (keyPath `id`):

### `profile` (one record, id `me`)
```js
{
  id: 'me', schema: 1,
  fullName, preferredName, photoId,          // photoId → photos store
  jobTitle, company,
  phones:  [{ id, label: 'Mobile'|'Work'|'Home'|'Other', value }],
  whatsapp,
  emails:  [{ id, label: 'Personal'|'Work'|'Other', value }],
  website,
  socials: [{ id, network: 'linkedin'|'instagram'|'github'|'x'|'youtube'|'facebook'|'tiktok'|'telegram'|'other', label, value }],
  address: { street, city, region, postcode, country },
  birthday,                                   // YYYY-MM-DD
  bio,
  custom:  [{ id, label, value }],
  updatedAt
}
```

### `cards`
```js
{
  id, type: 'personal'|'professional'|'social'|'business'|'custom',
  title, displayName, subtitle,
  photoId,                       // optional own photo
  photoMode: 'auto'|'scene',     // auto: own photo → profile photo → painted scene
  scene: 'sky'|'lake'|'dusk'|'forest'|'sand'|'night'|'rose'|'mint',
  staticPhoto,                   // demo only: bundled images/demo/*.jpg
  preset: 'personal'|'professional'|'social'|'custom',
  shareFields: { [itemKey]: boolean },   // explicit switches; missing keys fall back to the preset, else OFF
  order, createdAt, updatedAt
}
```

Item keys: `fullName`, `preferredName`, `photo`, `jobTitle`, `company`, `phone:<id>`, `whatsapp`, `email:<id>`, `website`, `social:<id>`, `address`, `birthday`, `bio`, `custom:<id>`.

### `photos`
```js
{ id, type: 'image/jpeg', buffer: ArrayBuffer, width, height, tint: '#rrggbb', createdAt }
```
Stored as ArrayBuffer (safest across iOS IndexedDB versions). `tint` is sampled from the bottom of the photo and drives the card's gradient.

### localStorage `nexo.settings`
`theme`, `textSize`, `selectedCardId`, `checklistHidden`, `lastBackupAt`, `shareCount`, `lastSeenVersion`, `installTipDismissedAt`, `backupReminderDismissedAt`. Never contact data.

## Sharing pipeline

```
profile ──listShareItems()──► items ──resolveSelection(card)──► { key: bool }
   │                                                              │
   └──────────────── buildSharePayload(profile, selection) ◄──────┘   (explicit allowlist)
                                   │
                                ContactData
               ┌───────────────────┼─────────────────────┐
         payloadRows()        encodeVCard()        encodeVCard({photo, fold})
       (live preview)         → QR (SVG)            → .vcf file / share
```

The preview, the QR and the file are all produced from the same `ContactData`, so the preview is exactly what's shared. ContactData has no ids and no profile references.

### Format

vCard 3.0 (best recognised by iOS and Android cameras). WhatsApp and social links use Apple's `itemN.X-ABLabel` labels; other apps import them as phone numbers / URLs. Bio and custom fields go into `NOTE`. The profile photo is only ever in `.vcf` files (too big for a QR). No custom format was needed for the MVP.

### Scanning

`BarcodeDetector` when the browser supports `qr_code`, otherwise bundled jsQR on a downscaled centre crop. Results go through `parseScanned()` — size-capped, http(s)-only links, PHOTO ignored — and are rendered as text. Saving builds a fresh, normalised vCard (unknown properties dropped) and is always a user action.

## Brightness

`BrightnessService.enter()/exit()` wraps QR presentation:

- **Web:** pure white surface + Screen Wake Lock (released on exit and when the app is hidden). Hardware brightness is not touched; the UI says so.
- **Native (future):** if `window.Capacitor.Plugins.ScreenBrightness` exists (API of `@capacitor-community/screen-brightness`), it reads the current value, sets 1.0, and restores the original on exit or when backgrounded.

To package natively later: `npm i @capacitor/core @capacitor/cli @capacitor-community/screen-brightness`, `npx cap init NEXO app.nexo --web-dir=dist`, `npx cap add ios android`, `npm run build && npx cap sync`. No app code changes are needed.

## Future: optional online dynamic links (not in the MVP)

A static QR can't be revoked. A later, opt-in mode could add revocable sharing without giving up local-first:

1. The phone encrypts the selected `ContactData` with a random key K (AES-GCM).
2. Uploads only the ciphertext to a tiny relay (`POST /s` → `{ id, deleteToken, expiresAt }`).
3. The QR holds `https://nexo.example/s/<id>#<K>` — the key sits in the URL fragment, which browsers never send to the server.
4. The recipient's browser fetches the ciphertext, decrypts locally, shows the contact and offers `.vcf`.
5. The owner can delete (`DELETE /s/<id>` with `deleteToken`) or let it expire; scans after that fail.

The server only ever sees ciphertext, an expiry and a scan counter. This would live in a separate `services/LinkService.js` behind an explicit setting, and the QR screen would clearly label “Online link (revocable)” versus “Offline vCard (permanent)”.
