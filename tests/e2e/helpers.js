import { expect } from '@playwright/test';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';

export async function onboard(page, { name = 'Arun Kumar', phone = '+974 5555 0101', email = 'arun@example.com', type = 'professional' } = {}) {
  await page.goto('./');
  await page.getByTestId('tour-skip').click();
  await page.getByTestId('onb-full-name').fill(name);
  await page.getByTestId('onb-next').click(); // → photo
  await page.getByTestId('onb-next').click(); // → details (continue without photo)
  await page.getByTestId('onb-phone').fill(phone);
  await page.getByTestId('onb-email').fill(email);
  await page.getByTestId('onb-next').click(); // → card
  await page.getByTestId(`onb-type-${type}`).click();
  await page.getByTestId('onb-next').click(); // → review
  await page.getByTestId('onb-next').click(); // finish
  await expect(page.getByTestId('show-qr')).toBeVisible();
  await page.mouse.move(1, 1); // notices pause while hovered; don't leave the mouse on one
}

/** Screenshot the on-screen QR and decode it, exactly like a phone camera would. */
export async function readQR(page) {
  const box = page.getByTestId('qr-code');
  await expect(box.locator('svg')).toBeVisible();
  const png = PNG.sync.read(await box.screenshot());
  const res = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return res ? res.data : null;
}

export async function noHorizontalScroll(page) {
  const overflow = await page.evaluate(() => {
    const all = [document.documentElement, document.body, ...document.querySelectorAll('[data-scroll]')];
    return all.some((el) => el.scrollWidth > el.clientWidth + 1);
  });
  expect(overflow).toBe(false);
}

export async function inViewport(page, locator) {
  const vp = page.viewportSize();
  const b = await locator.boundingBox();
  expect(b).not.toBeNull();
  expect(b.y + b.height).toBeLessThanOrEqual(vp.height + 1);
  expect(b.x).toBeGreaterThanOrEqual(-1);
  expect(b.x + b.width).toBeLessThanOrEqual(vp.width + 1);
}
