import { expect, type Page } from '@playwright/test';

/** Path of the studio. The verification harness uses hash routing (`/#/studio`). */
export const STUDIO = process.env.E2E_STUDIO_PATH ?? '/studio';

export async function openStudio(page: Page) {
  await page.goto(STUDIO);
  await expect(page.getByTestId('dataset-title')).toBeVisible();
}

export async function pickDataset(page: Page, name: string) {
  await page.getByRole('option', { name: new RegExp(`^${name}`) }).click();
  await expect(page.getByTestId('dataset-title')).toHaveText(name);
}
