import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const screenshots = 'docs/screenshots';

test.beforeAll(async () => {
  await mkdir(screenshots, { recursive: true });
});

test('desktop layout at 1440 by 900', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Plan the series/ })).toBeVisible();
  await page.screenshot({ path: `${screenshots}/reserve-desktop-1440x900.png` });
});

test('mobile board scrolls inside the page at 390 by 844', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Plan the series/ })).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  const boardDimensions = await page.locator('.board-wrap').evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(boardDimensions.scrollWidth).toBeGreaterThan(boardDimensions.clientWidth);
  await expect(page.locator('.board-head')).toHaveCSS('position', 'sticky');
  await expect(page.locator('.role-tag').first()).toHaveCSS('position', 'sticky');
  await expect(page.getByRole('button', { name: 'G1' })).toHaveCSS('height', '44px');
  const heroLayout = await page.evaluate(() => {
    const headline = document.querySelector('.hero h1')!.getBoundingClientRect();
    const readout = document.querySelector('.hero-readout')!.getBoundingClientRect();
    return readout.top > headline.bottom;
  });
  expect(heroLayout).toBe(true);
  await page.screenshot({ path: `${screenshots}/reserve-mobile-390x844.png` });
});
