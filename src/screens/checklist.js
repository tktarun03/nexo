// "Get started" steps that tick themselves off from real data.
import { t } from '../utils/i18n.js';
import { state } from '../state.js';
import { getSettings } from '../services/SettingsService.js';

export function checklist(ctx) {
  const p = state.profile;
  const s = getSettings();
  const ways = (p ? p.phones.filter((x) => x.value.trim()).length + p.emails.filter((x) => x.value.trim()).length + (p.whatsapp.trim() ? 1 : 0) : 0);
  const items = [
    { id: 'photo', title: t('Add a profile photo'), done: Boolean(p?.photoId), action: t('Add'), go: () => ctx.go('/profile') },
    { id: 'ways', title: t('Add two ways to reach you'), done: ways >= 2, action: t('Add'), go: () => ctx.go('/profile') },
    { id: 'cards', title: t('Create a second card'), done: state.cards.length >= 2, action: t('Create'), go: () => ctx.go('/card/new') },
    { id: 'qr', title: t('Show your first QR'), done: s.shareCount > 0, action: t('Show'), go: () => state.cards[0] && ctx.go(`/qr/${state.cards[0].id}`) },
    { id: 'backup', title: t('Make a backup file'), done: s.lastBackupAt > 0, action: t('Back up'), go: () => ctx.go('/settings') },
  ];
  return { items, done: items.filter((i) => i.done).length };
}
