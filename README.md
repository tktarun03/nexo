# NEXO — Your identity. Your rules.

A privacy-first digital contact wallet. Keep your details on your phone, make a photo card for each side of you, switch each detail on or off, and show a QR that any iPhone or Android camera can save as a contact.

**Live:** <https://tktarun03.github.io/nexo/>

- No account, no server, no tracking. Data lives in this browser (IndexedDB).
- Only switched-on details go into the QR (standard vCard 3.0, generated on the device).
- Scan other people's QR codes, review, then save — never automatic.
- Works offline once installed. Backup and restore with a JSON file.

## Run it locally

Requires Node 20+.

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. `npm run dev` also listens on your network, so you can open `http://<your-computer-ip>:5173` on a phone on the same Wi-Fi.

> The **camera scanner needs HTTPS** (or `localhost`). Over plain LAN HTTP, everything works except live scanning — “Scan from a photo” still does. For a full phone test, use the deployed site, or a tunnel (`npx cloudflared tunnel --url http://localhost:5173`), or serve the build with a trusted local certificate (e.g. `mkcert`).

## Build and preview

```bash
npm run build      # → dist/
npm run preview    # serves dist/ on :4173 (with the service worker)
```

## Tests

```bash
npm test           # unit: privacy filter, vCard, QR encode/decode, storage, backup, structure
npm run test:e2e   # Playwright: onboarding, sharing, QR decode from screen, undo notices, scan, settings — at 375, 390 and 430 px
```

First run of the browser tests: `npx playwright install chromium`.

## Hosting

Any static host works — `dist/` is plain files with relative paths.

- **GitHub Pages (this repo):** pushes to `main` run the tests, build, and deploy via GitHub Actions. In the repo's *Settings → Pages*, set **Source** to **GitHub Actions** once.
- **Elsewhere (Netlify, Cloudflare Pages, Vercel, nginx):** build command `npm run build`, publish directory `dist`. Serve over HTTPS so the PWA installs and the camera works.

## Install on a phone

- **iPhone:** open the site in Safari → Share → *Add to Home Screen*. Set up NEXO inside the Home Screen app — iOS keeps its storage separate from Safari. Use a backup file to move data.
- **Android:** open in Chrome → ⋮ → *Install app*.

## Project layout

See [`AGENTS.md`](AGENTS.md) for the repo map and rules, [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the data model, sharing pipeline, brightness adapter and the future revocable-link design, and [`CHANGELOG.md`](CHANGELOG.md) for releases.

## Credits

Created out of passion by **Arunkumar Thamilarasu** — [YouTube](https://www.youtube.com/@BeyondObviousArun) · [Instagram](https://www.instagram.com/beyondobviousarun/) · [GitHub](https://github.com/tktarun03).

Open-source libraries: Swiper, Lucide, node-qrcode, jsQR, idb, Outfit (font), Vite, vite-plugin-pwa.
