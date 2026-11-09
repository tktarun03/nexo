---
name: release
description: Ship a new NEXO version — release notes, version bump, tests, push, verify the Pages deploy.
---

# Release NEXO

1. Decide the version (semver): fixes → patch, features → minor.
2. Update all three, identically:
   - `package.json` → `"version"`
   - `src/version.js` → add a new entry at the **top** of `RELEASES` (version, date, 1-line notes, newest first)
   - `CHANGELOG.md` → new `## x.y.z — YYYY-MM-DD` section at the top
3. If a saved field changed, confirm `migrate*()` gives it a default and add a unit test.
4. Run `npm test` and `npm run test:e2e` (all three viewport projects). Fix before continuing.
5. Commit (`Release x.y.z: <summary>`) and push to `main`.
6. Verify: `gh run list --repo tktarun03/nexo --limit 3` until **Tests** and **Deploy to GitHub Pages** both succeed, then open <https://tktarun03.github.io/nexo/> and check Settings → Version history shows the new version.
7. Report briefly: flaws and untested areas first, with [Certain]/[Likely]/[Guessing] tags, then what shipped. Say what was tested in a simulator versus a real device.

Users who already had the app see “Updated to version x.y.z” once (not on first install).
