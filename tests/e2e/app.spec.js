import { test, expect } from '@playwright/test';
import QRCode from 'qrcode';
import { onboard, readQR, noHorizontalScroll, inViewport } from './helpers.js';

test.describe('first launch and persistence', () => {
  test('onboarding creates a profile and card that survive a reload', async ({ page }) => {
    await onboard(page);
    await noHorizontalScroll(page);
    await inViewport(page, page.getByTestId('show-qr'));
    await page.reload();
    await expect(page.getByTestId('show-qr')).toBeVisible();
    await expect(page.locator('.id-name').first()).toHaveText('Arun Kumar');
  });

  test('onboarding keeps values when going back', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('tour-skip').click();
    await page.getByTestId('onb-full-name').fill('Kept Name');
    await page.getByTestId('onb-next').click();
    await page.getByTestId('onb-back').click();
    await expect(page.getByTestId('onb-full-name')).toHaveValue('Kept Name');
    await inViewport(page, page.getByTestId('onb-next'));
    await noHorizontalScroll(page);
  });

  test('demo data never reaches the device', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('start-demo').click();
    await expect(page.locator('.id-name').first()).toHaveText('Maya Rao');
    await page.getByTestId('exit-demo').click();
    await expect(page.getByTestId('tour-next')).toBeVisible();
    const count = await page.evaluate(() => new Promise((resolve) => {
      const req = indexedDB.open('nexo');
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('cards')) return resolve(0);
        const r = db.transaction('cards').objectStore('cards').count();
        r.onsuccess = () => resolve(r.result);
      };
    }));
    expect(count).toBe(0);
  });
});

test.describe('selective sharing', () => {
  test('switched-off details are absent from the preview and the QR itself', async ({ page }) => {
    await onboard(page);
    await page.getByTestId('choose-fields').click();
    const phoneToggle = page.locator('[data-testid^="toggle-phone:"]');
    await expect(phoneToggle).toBeChecked();
    await phoneToggle.uncheck();
    await expect(page.getByTestId('preset-custom')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('review').click();
    const sharing = page.getByTestId('sharing-list');
    await expect(sharing).toContainText('Arun Kumar');
    await expect(sharing).not.toContainText('5555 0101');
    await page.getByTestId('not-shared').locator('summary').click();
    await expect(page.getByTestId('not-shared')).toContainText('Mobile');
    await page.getByTestId('generate-qr').click();
    const text = await readQR(page);
    expect(text).toContain('BEGIN:VCARD');
    expect(text).toContain('FN:Arun Kumar');
    expect(text).toContain('arun@example.com');
    expect(text).not.toContain('5555 0101');
    await noHorizontalScroll(page);
  });

  test('QR updates instantly when a detail is switched on the QR screen', async ({ page }) => {
    await onboard(page);
    await page.getByTestId('show-qr').click();
    expect(await readQR(page)).toContain('5555 0101');
    await page.getByTestId('qr-fields').click();
    await page.locator('[data-testid^="qr-toggle-phone:"]').uncheck();
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await readQR(page)) || '').not.toContain('5555 0101');
    // the change is remembered for the card
    await page.getByTestId('qr-close').click();
    await page.getByTestId('choose-fields').click();
    await expect(page.locator('[data-testid^="toggle-phone:"]')).not.toBeChecked();
  });

  test('switching preset can be undone', async ({ page }) => {
    await onboard(page);
    await page.getByTestId('choose-fields').click();
    await expect(page.locator('[data-testid^="toggle-email:"]')).toBeChecked();
    await page.getByTestId('preset-social').click();
    await expect(page.locator('[data-testid^="toggle-email:"]')).not.toBeChecked();
    const toast = page.getByTestId('toast');
    await expect(toast).toContainText('Switched to Social sharing');
    await toast.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('[data-testid^="toggle-email:"]')).toBeChecked();
    await expect(page.getByTestId('preset-professional')).toHaveAttribute('aria-checked', 'true');
    await page.reload();
    await expect(page.locator('[data-testid^="toggle-email:"]')).toBeChecked();
  });

  test('Close on the QR returns home and Back closes sheets first', async ({ page }) => {
    await onboard(page);
    await page.getByTestId('choose-fields').click();
    await page.getByTestId('review').click();
    await page.getByTestId('generate-qr').click();
    await page.getByTestId('qr-fields').click();
    await expect(page.locator('.sheet')).toBeVisible();
    await page.goBack();
    await expect(page.locator('.sheet')).toHaveCount(0);
    await expect(page.getByTestId('qr-code')).toBeVisible();
    await page.getByTestId('qr-close').click();
    await expect(page.getByTestId('show-qr')).toBeVisible();
  });
});

test.describe('undo notices', () => {
  test('deleting a card can be undone', async ({ page }) => {
    await onboard(page);
    await page.getByTestId('edit-card').click();
    await page.getByTestId('delete-card').click();
    await page.getByTestId('confirm-yes').click(); // only card → confirm
    const toast = page.getByTestId('toast');
    await expect(toast).toContainText('Card deleted');
    await expect(page.locator('.id-name')).toHaveCount(0);
    await toast.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('.id-name').first()).toHaveText('Arun Kumar');
    await page.reload();
    await expect(page.locator('.id-name').first()).toHaveText('Arun Kumar');
  });

  test('removing a phone can be undone', async ({ page }) => {
    await onboard(page);
    await page.getByTestId('open-profile').click();
    await expect(page.getByTestId('phone-input')).toHaveValue('+974 5555 0101');
    await page.getByRole('button', { name: 'Remove phone' }).click();
    await expect(page.getByTestId('phone-input')).toHaveCount(0);
    const toast = page.getByTestId('toast');
    await expect(toast).toContainText('Removed phone');
    await toast.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByTestId('phone-input')).toHaveValue('+974 5555 0101');
    await page.reload();
    await expect(page.getByTestId('phone-input')).toHaveValue('+974 5555 0101');
  });

  test('profile edits save automatically', async ({ page }) => {
    await onboard(page);
    await page.getByTestId('open-profile').click();
    await page.getByTestId('full-name').fill('Arunkumar T');
    await expect(page.getByTestId('save-state')).toHaveText(/Saved/);
    await page.reload();
    await expect(page.getByTestId('full-name')).toHaveValue('Arunkumar T');
  });

  test('timing: plain notice ~4.5 s, undo notice still there at 5.5 s', async ({ page }) => {
    await onboard(page); // shows the plain "Your card is ready" notice
    const toast = page.getByTestId('toast');
    await expect(toast).toContainText('Your card is ready');
    await page.waitForTimeout(5200);
    await expect(toast).toHaveCount(0);
    await page.getByTestId('choose-fields').click();
    await page.getByTestId('preset-social').click();
    await page.waitForTimeout(5500);
    await expect(page.getByTestId('toast')).toContainText('Switched to');
  });

  test('update notice appears once per version, never on first install', async ({ page }) => {
    await onboard(page);
    await page.reload();
    await expect(page.getByTestId('toast')).toHaveCount(0);
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('nexo.settings'));
      s.lastSeenVersion = '0.9.0';
      localStorage.setItem('nexo.settings', JSON.stringify(s));
    });
    await page.reload();
    await expect(page.getByTestId('toast')).toContainText('Updated to version');
    await page.reload();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('toast').filter({ hasText: 'Updated to version' })).toHaveCount(0);
  });
});

test.describe('receiving', () => {
  test('scan a contact QR from a photo, review it, then save a .vcf', async ({ page }, info) => {
    const vcard = 'BEGIN:VCARD\r\nVERSION:3.0\r\nN:Rao;Maya;;;\r\nFN:Maya Rao\r\nORG:Lumen Studio\r\nTEL;TYPE=CELL:+1 202 555 0143\r\nEMAIL;TYPE=INTERNET:maya@example.com\r\nURL:javascript:alert(1)\r\nEND:VCARD';
    const file = info.outputPath('contact-qr.png');
    await QRCode.toFile(file, vcard, { width: 600, margin: 4 });
    await page.goto('./#/scan');
    await page.getByTestId('scan-file').setInputFiles(file);
    const result = page.getByTestId('scan-result');
    await expect(result).toContainText('Maya Rao');
    await expect(result).toContainText('+1 202 555 0143');
    await expect(result).not.toContainText('javascript');
    await expect(result).toContainText('Nothing has been saved yet');
    const download = page.waitForEvent('download');
    await page.getByTestId('save-contact').click();
    const dl = await download;
    expect(dl.suggestedFilename()).toBe('Maya-Rao.vcf');
    const text = await (await dl.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
    expect(text).toContain('FN:Maya Rao');
    expect(text).not.toContain('javascript');
  });
});

test.describe('settings', () => {
  test('backup, self-check and erase', async ({ page }) => {
    await onboard(page);
    await page.getByTestId('open-settings').click();
    const download = page.waitForEvent('download');
    await page.getByTestId('backup').click();
    const dl = await download;
    expect(dl.suggestedFilename()).toMatch(/^nexo-backup-\d{4}-\d{2}-\d{2}\.json$/);
    await page.getByTestId('run-self-check').click();
    const results = page.getByTestId('self-check');
    await expect(results).toContainText('Privacy filter');
    await expect(results.locator('.check-fail')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByTestId('erase').click();
    await page.getByTestId('confirm-yes').click();
    await expect(page.getByTestId('tour-next')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('tour-next')).toBeVisible();
  });

  test('about shows the creator and follow links', async ({ page }) => {
    await page.goto('./#/about');
    await expect(page.getByText('Arunkumar Thamilarasu').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /YouTube/ })).toHaveAttribute('href', /BeyondObviousArun/);
    await noHorizontalScroll(page);
  });
});
