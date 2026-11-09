// Lightweight UI settings in localStorage. Never contact data.
const KEY = 'nexo.settings';

const DEFAULTS = {
  theme: 'system', // system | light | dark
  textSize: 'default', // small | default | large | xlarge
  selectedCardId: null,
  checklistHidden: false,
  lastBackupAt: 0,
  shareCount: 0,
  lastSeenVersion: '',
  installTipDismissedAt: 0,
  backupReminderDismissedAt: 0,
};

let cache = null;

export function migrateSettings(raw) {
  const s = { ...DEFAULTS };
  if (raw && typeof raw === 'object') {
    for (const k of Object.keys(DEFAULTS)) if (typeof raw[k] === typeof DEFAULTS[k] || (k === 'selectedCardId' && typeof raw[k] === 'string')) s[k] = raw[k];
  }
  if (!['system', 'light', 'dark'].includes(s.theme)) s.theme = 'system';
  if (!['small', 'default', 'large', 'xlarge'].includes(s.textSize)) s.textSize = 'default';
  return s;
}

export function getSettings() {
  if (cache) return cache;
  try {
    cache = migrateSettings(JSON.parse(localStorage.getItem(KEY) || '{}'));
  } catch {
    cache = migrateSettings({});
  }
  return cache;
}

export function setSettings(patch) {
  cache = migrateSettings({ ...getSettings(), ...patch });
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* private mode / quota: settings stay in memory for this session */
  }
  applyAppearance();
  return cache;
}

export function clearSettings() {
  cache = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  applyAppearance();
}

export function applyAppearance() {
  const s = getSettings();
  const root = document.documentElement;
  if (s.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = s.theme;
  root.dataset.text = s.textSize;
  const dark = s.theme === 'dark' || (s.theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.removeAttribute('media');
    m.setAttribute('content', dark ? '#0c0f0d' : '#f4f5f3');
  });
}
