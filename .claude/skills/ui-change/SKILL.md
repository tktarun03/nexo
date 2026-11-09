---
name: ui-change
description: Checklist for any NEXO screen or component change, so it stays mobile-Safari-safe, private and consistent.
---

# UI change checklist

- Build DOM with `h()`; never set `innerHTML` with anything but app-made SVG via `setTrustedSVG()`.
- Text through `t()`; user data only as `{placeholders}`.
- Colours from `src/styles/tokens.css`; check light **and** dark (Settings → Theme).
- Inputs ≥16px font, tap targets ≥44px, nothing below 11px; respect `--safe-*` insets.
- Full-screen layouts: `.screen` + `flex: 1; min-height: 0` with an inner `[data-scroll]`; no `100vh`.
- Updating a field as the user types? Change it in place — re-rendering the form loses focus on iOS.
- Data changed? Show a `toast()`; add Undo when it can be safely reversed, and make Undo re-check current state.
- Anything that could show more contact data: route it through `buildSharePayload()` and extend `tests/unit/privacy.test.js`.
- Add or update a Playwright flow in `tests/e2e/`; run all three viewport projects (no horizontal scroll, footer buttons visible).
- `prefers-reduced-motion`: animations must still make sense with motion off.
