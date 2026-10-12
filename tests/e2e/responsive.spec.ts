import { expect, test } from '@playwright/test';
import { openStudio } from './helpers';

test('the studio is usable on a phone', async ({ page }) => {
  await openStudio(page);
  await expect(page.getByTestId('lattice-canvas')).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('option', { name: /^Birds/ }).click();
  await expect(page.getByTestId('dataset-title')).toHaveText('Birds');
});
