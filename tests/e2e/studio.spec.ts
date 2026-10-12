import { expect, test } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { openStudio, pickDataset } from './helpers';

test('landing page leads to the studio', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('launch').click();
  await expect(page.getByTestId('dataset-title')).toHaveText('Sport');
});

test('playback controls step through the Sport trace', async ({ page }) => {
  await openStudio(page);
  const counter = page.getByTestId('step-counter');
  await expect(counter).toHaveText('0 / 32');
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(counter).toHaveText('1 / 32');
  await page.getByRole('button', { name: 'Previous step' }).click();
  await expect(counter).toHaveText('0 / 32');
  await page.getByRole('button', { name: 'Last step' }).click();
  await expect(counter).toHaveText('32 / 32');
  await expect(page.getByTestId('vs-size')).toHaveText('|VS| = 6');
  await expect(page.getByTestId('boundary-G').getByRole('button')).toHaveCount(2);
  await expect(page.getByTestId('boundary-S')).toContainText('⟨?, team, ?, national, Saturday⟩');
  await page.getByRole('button', { name: 'Reset to the initial state' }).click();
  await expect(counter).toHaveText('0 / 32');
  // example mode: one step per training example
  await page.getByRole('radio', { name: 'Example mode' }).click();
  await expect(counter).toHaveText('0 / 5');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(counter).toHaveText('2 / 5');
  await expect(page.getByTestId('boundary-S')).toContainText('⟨?, team, outdoor, national, Saturday⟩');
});

test('jump to step and play', async ({ page }) => {
  await openStudio(page);
  await page.getByTestId('scrubber').fill('19');
  await expect(page.getByTestId('step-counter')).toHaveText('19 / 32');
  // step 19 = candidate filtering of example 3: 13 candidates, 3 kept
  await expect(page.getByTestId('candidates').locator('li')).toHaveCount(13);
  await expect(page.getByTestId('candidates').getByText(/^kept/)).toHaveCount(3);
  await expect(page.locator('[data-testid=pseudocode] li[data-active]')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Playback speed' }).selectOption('4');
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByTestId('step-counter')).toHaveText('32 / 32', { timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
});

test('the final diamond is the six-hypothesis version space with mathematically valid edges', async ({ page }) => {
  await openStudio(page);
  await page.getByTestId('reveal-button').click();
  await expect(page.getByTestId('lattice-mode')).toContainText('Complete version space · 6 hypotheses');
  const canvas = page.getByTestId('lattice-canvas');
  await expect(canvas.locator('[data-node]')).toHaveCount(8); // 6 + ⊤ + ⊥
  await expect(canvas.locator('[data-edge-kind=cover]')).toHaveCount(7);
  await canvas.locator('[data-node]', { hasText: '⟨?, team, ?, national, ?⟩' }).click();
  const details = page.getByTestId('node-details');
  await expect(details).toBeVisible();
  await expect(details.getByText('consistent', { exact: true })).toHaveCount(5);
  await page.getByRole('button', { name: 'Close details' }).click();
  await expect(details).toBeHidden();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Fit to view' }).click();
});

test('Birds uses interval hypotheses and shows a partial graph for the infinite version space', async ({ page }) => {
  await openStudio(page);
  await pickDataset(page, 'Birds');
  await page.getByRole('button', { name: 'Last step' }).click();
  await expect(page.getByTestId('lattice-mode')).toContainText('infinite version space');
  await expect(page.getByTestId('boundary-G')).toContainText('⟨?, [0, 59], ?⟩');
  await expect(page.getByTestId('boundary-S')).toContainText('⟨True, [30, 40], warm colour⟩');
  await expect(page.locator('[data-role=sample]')).toHaveCount(3);
});

test('contradictory data empty the version space', async ({ page }) => {
  await openStudio(page);
  await pickDataset(page, 'Contradictory labels');
  await page.getByRole('button', { name: 'Last step' }).click();
  await expect(page.getByTestId('vs-empty')).toBeVisible();
  await expect(page.getByTestId('vs-size')).toHaveText('|VS| = 0');
});

test('classification of slide 87', async ({ page }) => {
  await openStudio(page);
  await pickDataset(page, 'EnjoySport');
  await page.getByRole('button', { name: 'Classify' }).click();
  await page.getByRole('button', { name: 'Slide 86 — A' }).click();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'positive');
  await page.getByRole('button', { name: 'Slide 87 — B' }).click();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'negative');
  await page.getByRole('button', { name: 'Slide 87 — D' }).click();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'undetermined');
  await expect(page.getByTestId('verdict')).toContainText('2 positive');
});

test('importing a CSV goes through the wizard and reproduces the course result', async ({ page }) => {
  await openStudio(page);
  await page.getByRole('button', { name: 'Dataset' }).click();
  await page.getByTestId('file-input').setInputFiles(path.join(__dirname, 'fixtures', 'sport.csv'));
  await expect(page.getByRole('dialog', { name: 'Import a table' })).toBeVisible();
  await page.getByTestId('import-create').click();
  await expect(page.getByTestId('dataset-title')).toHaveText('sport');
  await page.getByRole('button', { name: 'Last step' }).click();
  await expect(page.getByTestId('vs-size')).toHaveText('|VS| = 6');
});

test('editing errors are reported and block the run', async ({ page }) => {
  await openStudio(page);
  await page.getByRole('button', { name: 'Dataset' }).click();
  const values = page.getByTestId('attr-1').getByLabel('Values (comma separated)');
  await values.fill('team');
  await expect(page.getByTestId('validation')).toContainText('"individual" is not in the domain');
  await expect(page.getByTestId('apply-dataset')).toBeDisabled();
  await values.fill('team, individual');
  await expect(page.getByTestId('apply-dataset')).toBeEnabled();
  // add an example and run
  await page.getByTestId('add-example').click();
  await expect(page.getByTestId('example-row-5')).toBeVisible();
  await page.getByTestId('apply-dataset').click();
  await expect(page.getByTestId('training-table').locator('tbody tr')).toHaveCount(6);
});

test('exports match the computed result', async ({ page }) => {
  await openStudio(page);
  await page.getByRole('button', { name: 'Export' }).click();
  const [json] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-json-main').click()]);
  const data = JSON.parse(fs.readFileSync((await json.path())!, 'utf8'));
  expect(data.final.versionSpace.size).toBe(6);
  expect(data.final.S).toEqual(['⟨?, team, ?, national, Saturday⟩']);
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-pdf-main').click()]);
  expect(fs.readFileSync((await pdf.path())!).subarray(0, 8).toString()).toBe('%PDF-1.4');
  const [svg] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-svg-lattice').click()]);
  expect(fs.readFileSync((await svg.path())!, 'utf8')).toContain('⟨?, team, ?, national, Saturday⟩');
  const [png] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-png-lattice').click()]);
  expect(fs.readFileSync((await png.path())!).subarray(1, 4).toString()).toBe('PNG');
});

test('presentation mode runs the guided Sport demo on the real engine', async ({ page }) => {
  await openStudio(page);
  await pickDataset(page, 'Birds');
  await page.getByRole('button', { name: 'Present to the class' }).click();
  const pres = page.getByTestId('presentation');
  await expect(pres).toBeVisible();
  await expect(page.getByTestId('scene-title')).toHaveText('The Sport dataset');
  for (let i = 0; i < 9; i++) await page.getByTestId('scene-next').click();
  await expect(page.getByTestId('scene-title')).toHaveText('Final version space');
  await expect(pres).toContainText('exactly 6 hypotheses');
  await page.getByRole('button', { name: 'Exit presentation' }).click();
  await expect(pres).toBeHidden();
});
