// Single source of truth for the in-app version history.
// VERSION must equal package.json "version" and the top entry of CHANGELOG.md (checked by tests/unit/structure.test.js).

/* global __APP_VERSION__ */
export const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';

/** Newest first. Each note is one short user-facing line. */
export const RELEASES = [
  {
    version: '1.0.0',
    date: '2026-11-09',
    notes: [
      'First release of NEXO: photo identity cards you swipe between.',
      'Choose exactly which details to share; the QR updates as you toggle.',
      'Standard vCard QR codes that iPhone and Android cameras recognise.',
      'Scan someone’s QR and review it before saving to Contacts.',
      'Works offline. No account, no server, no tracking.',
      'Backup and restore with a JSON file; erase everything in one step.',
    ],
  },
];
