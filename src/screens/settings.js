// Settings: appearance, backup/restore/erase, version history, self-check, about.
import { h } from '../utils/dom.js';
import { t } from '../utils/i18n.js';
import { icon } from '../components/Icon.js';
import { Row, Segmented, TopBar } from '../components/Controls.js';
import { openSheet, confirmSheet } from '../components/BottomSheet.js';
import { toast } from '../components/Toast.js';
import { state, load } from '../state.js';
import { getSettings, setSettings, clearSettings } from '../services/SettingsService.js';
import { buildBackup, backupFileName, parseBackup } from '../services/BackupService.js';
import { shareOrDownload } from '../services/ShareService.js';
import { runSelfCheck } from '../services/SelfCheck.js';
import { requestPersistence } from '../services/StorageService.js';
import { isStandalone, isIOS } from '../services/PwaService.js';
import { VERSION, RELEASES } from '../version.js';
import { bytesLabel } from '../utils/misc.js';

export const REPO_URL = 'https://github.com/tktarun03/nexo';

export async function makeBackup() {
  const data = await buildBackup(state.store);
  const text = JSON.stringify(data);
  const file = new File([text], backupFileName(), { type: 'application/json' });
  const res = await shareOrDownload(file, { title: t('NEXO backup') });
  if (res === 'cancelled') return false;
  setSettings({ lastBackupAt: Date.now() });
  toast(t('Backup saved'), { kind: 'good', body: `${file.name} · ${bytesLabel(file.size)}` });
  return true;
}

export function openWhatsNew(ctx) {
  const list = h(
    'div',
    { class: 'stack' },
    RELEASES.map((r) =>
      h(
        'section',
        { class: 'release' },
        h('h3', null, `${t('Version')} ${r.version}`, h('span', { class: 'muted small' }, ` · ${r.date}`)),
        h('ul', null, r.notes.map((n) => h('li', null, t(n)))),
      ),
    ),
  );
  openSheet({ title: t('Version history'), content: list });
}

export async function render(ctx) {
  const s = getSettings();
  const demo = state.mode === 'demo';

  const restoreInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'visually-hidden', 'data-testid': 'restore-file' });
  restoreInput.addEventListener('change', async () => {
    const file = restoreInput.files?.[0];
    restoreInput.value = '';
    if (!file) return;
    let parsed;
    try {
      parsed = parseBackup(await file.text());
    } catch (err) {
      return toast(t('Couldn’t restore'), { kind: 'bad', body: err.message });
    }
    const ok = await confirmSheet({
      title: t('Replace everything on this device?'),
      message: t('Your current profile, cards and photos will be replaced by the backup. This can’t be undone.'),
      detail: h('p', { class: 'muted small' }, t('Backup: {n} cards, {p} photos', { n: parsed.cards.length, p: parsed.photos.length })),
      confirmLabel: t('Restore'),
      danger: true,
    });
    if (!ok) return;
    try {
      await state.store.replaceAll(parsed);
      await load();
      setSettings({ selectedCardId: parsed.cards[0]?.id || null });
      toast(t('Backup restored'), { kind: 'good', body: t('{n} cards', { n: parsed.cards.length }) });
      ctx.go(parsed.profile ? '/home' : '/welcome', { replace: true });
    } catch {
      toast(t('Couldn’t restore'), { kind: 'bad', body: t('Storage is full or blocked.') });
    }
  });

  async function eraseAll() {
    const ok = await confirmSheet({
      title: t('Erase all NEXO data?'),
      message: t('This deletes your profile, every card and photo from this device. It can’t be undone. Make a backup first if you might want them back.'),
      confirmLabel: t('Erase everything'),
      danger: true,
    });
    if (!ok) return;
    try {
      await state.store.eraseAll();
      clearSettings();
      await load();
      toast(t('All data erased'), { kind: 'good' });
      ctx.go('/welcome', { replace: true });
    } catch {
      toast(t('Couldn’t erase'), { kind: 'bad', body: t('Try again, or clear this site’s data in your browser settings.') });
    }
  }

  async function selfCheck() {
    const list = h('ul', { class: 'check-results', 'data-testid': 'self-check' }, h('li', { class: 'skeleton', style: { height: '160px' } }));
    openSheet({ title: t('Self-check'), content: h('div', { class: 'stack' }, h('p', { class: 'muted small' }, t('Runs entirely on this device.')), list) });
    const results = await runSelfCheck(state.store);
    list.replaceChildren(
      ...results.map((r) =>
        h(
          'li',
          { class: `check-${r.status}` },
          icon(r.status === 'pass' ? 'CircleCheck' : 'CircleAlert', { size: 18 }),
          h('span', { class: 'row-text' }, h('span', { class: 'row-title' }, t(r.name)), h('span', { class: 'row-detail' }, t(r.detail))),
        ),
      ),
    );
  }

  function installTip() {
    const steps = isIOS()
      ? [t('Open NEXO in Safari.'), t('Tap the Share button.'), t('Choose “Add to Home Screen”.')]
      : [t('Open NEXO in Chrome.'), t('Open the ⋮ menu.'), t('Choose “Install app” or “Add to Home screen”.')];
    openSheet({
      title: t('Add to Home Screen'),
      content: h(
        'div',
        { class: 'stack' },
        h('ol', { class: 'steps' }, steps.map((x) => h('li', null, x))),
        h('div', { class: 'note warn' }, icon('Info', { size: 18 }), h('span', null, t('On iPhone, the Home Screen app keeps its own storage, separate from Safari. Set up NEXO inside the Home Screen app, or move your data with a backup file.'))),
      ),
    });
  }

  function privacySheet() {
    const points = [
      ['HardDrive', t('Everything is stored in this browser on this device (IndexedDB). There is no NEXO server or account.')],
      ['QrCode', t('QR codes are made on your phone. Only the details you switch on are put in them.')],
      ['Eye', t('Anyone who sees or photographs your QR can copy what it contains.')],
      ['Lock', t('A QR made offline can’t be revoked after someone scans it.')],
      ['Shield', t('No analytics, no tracking, no ads.')],
      ['Trash2', t('Clearing browser data or uninstalling the Home Screen app erases your NEXO data. Keep a backup file.')],
    ];
    openSheet({
      title: t('Your privacy'),
      content: h('ul', { class: 'privacy-list' }, points.map(([ic, txt]) => h('li', null, h('span', { class: 'row-icon' }, icon(ic, { size: 18 })), h('span', null, txt)))),
    });
  }

  const feedbackUrl = `${REPO_URL}/issues/new?template=feedback.yml&version=${encodeURIComponent(VERSION)}`;
  const rateUrl = `${REPO_URL}/issues/new?template=rating.yml&version=${encodeURIComponent(VERSION)}`;

  const lastBackup = s.lastBackupAt ? new Date(s.lastBackupAt).toLocaleDateString() : t('Never');

  const el = h(
    'section',
    { class: 'settings-screen' },
    TopBar({ title: t('Settings'), onBack: () => ctx.back() }),
    h(
      'div',
      { class: 'scroll', 'data-scroll': '' },
      h(
        'div',
        { class: 'wrap' },
        demo
          ? h('div', { class: 'note accent', style: { marginTop: '8px' } }, icon('Sparkles', { size: 18 }), h('span', null, t('You’re in the demo. Backup, restore and erase are off so demo data can’t mix with yours.')), h('button', { type: 'button', class: 'btn sm secondary', onclick: () => ctx.exitDemo() }, t('Exit')))
          : null,
        h(
          'section',
          { class: 'section' },
          h('div', { class: 'group' }, Row({ iconName: 'User', title: t('My profile'), detail: state.profile?.fullName || '', onClick: () => ctx.go('/profile'), testid: 'settings-profile' })),
        ),
        h(
          'section',
          { class: 'section' },
          h('h2', { class: 'section-title' }, t('Appearance')),
          h(
            'div',
            { class: 'group pad' },
            h('div', { class: 'stack tight' }, h('span', { class: 'field-label' }, t('Theme')), Segmented({
              label: t('Theme'),
              value: s.theme,
              options: [{ value: 'system', label: t('System'), icon: 'Monitor' }, { value: 'light', label: t('Light'), icon: 'Sun' }, { value: 'dark', label: t('Dark'), icon: 'Moon' }],
              onChange: (v) => setSettings({ theme: v }),
            })),
            h('div', { class: 'stack tight' }, h('span', { class: 'field-label' }, t('Text size')), Segmented({
              label: t('Text size'),
              value: s.textSize,
              options: [{ value: 'small', label: 'A−' }, { value: 'default', label: 'A' }, { value: 'large', label: 'A+' }, { value: 'xlarge', label: 'A++' }],
              onChange: (v) => setSettings({ textSize: v }),
            })),
          ),
        ),
        h(
          'section',
          { class: 'section' },
          h('h2', { class: 'section-title' }, t('Your data')),
          h(
            'div',
            { class: 'group' },
            Row({ iconName: 'Download', title: t('Back up to a file'), detail: t('Last backup: {date}', { date: lastBackup }), onClick: demo ? null : () => makeBackup().then(() => ctx.refreshSoon()), testid: 'backup' }),
            Row({ iconName: 'Upload', title: t('Restore from a backup'), detail: t('Replaces what’s on this device'), onClick: demo ? null : () => restoreInput.click(), testid: 'restore' }),
            Row({
              iconName: 'ShieldCheck',
              title: t('Protect storage'),
              detail: t('Ask the browser not to clear NEXO data'),
              onClick: async () => {
                const ok = await requestPersistence();
                toast(ok ? t('Storage protected') : t('Browser said no'), { kind: ok ? 'good' : undefined, body: ok ? t('Data won’t be cleared automatically.') : t('Keep a backup file to be safe.') });
              },
            }),
            Row({ iconName: 'Trash2', title: t('Erase all data'), detail: t('Profile, cards and photos'), danger: true, onClick: demo ? null : eraseAll, testid: 'erase' }),
          ),
          h('p', { class: 'muted small', style: { margin: '10px 6px 0' } }, t('NEXO keeps data only in this browser. Clearing browser data, private browsing, or Safari’s 7-day cleanup for unvisited sites can erase it. Back up now and then.')),
          restoreInput,
        ),
        h(
          'section',
          { class: 'section' },
          h('h2', { class: 'section-title' }, t('App')),
          h(
            'div',
            { class: 'group' },
            Row({ iconName: 'Shield', title: t('Your privacy'), detail: t('How NEXO handles your data'), onClick: privacySheet }),
            !isStandalone() ? Row({ iconName: 'Smartphone', title: t('Add to Home Screen'), detail: t('Use NEXO like an app, offline'), onClick: installTip }) : null,
            Row({ iconName: 'History', title: t('Version history'), detail: `${t('Version')} ${VERSION}`, onClick: () => openWhatsNew(ctx), testid: 'version-history' }),
            Row({ iconName: 'Wand2', title: t('Run self-check'), detail: t('Storage, privacy filter, QR, camera'), onClick: selfCheck, testid: 'run-self-check' }),
            Row({ iconName: 'MessageSquare', title: t('Send feedback'), detail: t('Opens a GitHub form — you choose what to send'), href: feedbackUrl }),
            Row({ iconName: 'Star', title: t('Rate NEXO'), href: rateUrl }),
            Row({ iconName: 'Info', title: t('About NEXO'), onClick: () => ctx.go('/about'), testid: 'open-about' }),
          ),
        ),
        h('p', { class: 'muted small center', style: { margin: '24px 0 8px' } }, `NEXO ${VERSION} · ${t('Your identity. Your rules.')}`),
      ),
    ),
  );
  return { el, title: t('Settings') };
}
