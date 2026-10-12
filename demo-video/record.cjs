// Records a ~90 s screen capture walkthrough of the studio (Playwright video).
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const OUT = path.join(__dirname, 'raw');
const CSV = path.join(__dirname, '..', 'tests', 'e2e', 'fixtures', 'sport.csv');
const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_EXE });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
    acceptDownloads: true,
  });
  const page = await ctx.newPage();

  const caption = async (text) => {
    log(text);
    await page.evaluate((txt) => {
      let el = document.getElementById('__cap');
      if (!el) {
        el = document.createElement('div');
        el.id = '__cap';
        el.style.cssText =
          'position:fixed;left:50%;bottom:36px;transform:translateX(-50%);z-index:2147483647;max-width:80%;' +
          'padding:12px 24px;border-radius:12px;background:rgba(10,10,25,.88);color:#fff;font:600 28px system-ui,sans-serif;' +
          'border:1px solid rgba(139,125,255,.7);box-shadow:0 8px 30px rgba(0,0,0,.5);pointer-events:none;text-align:center';
      }
      (document.fullscreenElement || document.body).appendChild(el);
      el.textContent = txt;
    }, text);
  };
  const wait = (ms) => page.waitForTimeout(ms);
  const step = async (name, fn) => {
    try { await fn(); } catch (e) { log(`!! ${name} failed: ${String(e.message).split('\n')[0]}`); }
  };
  const next = async (n, gap = 900) => {
    for (let i = 0; i < n; i++) { await page.getByRole('button', { name: 'Next step' }).click(); await wait(gap); }
  };

  // 1 — landing
  await page.goto(BASE + '/');
  await wait(600);
  await caption('Candidate Elimination Studio — Mitchell’s algorithm, computed exactly');
  await wait(3000);
  await page.getByTestId('launch').click();
  await page.getByTestId('dataset-title').waitFor();

  // 2 — existing data: Sport, step by step
  await step('theme', async () => {
    await caption('Light mode…');
    await page.getByRole('button', { name: 'Switch to light mode' }).click();
    await wait(2800);
    await caption('…and back to dark mode');
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await wait(1500);
  });
  await caption('Existing course datasets: Sport — training examples, S and G boundaries');
  await wait(4000);
  await step('detailed steps', async () => {
    await caption('Detailed mode: present → filter → generate candidates → prune');
    await next(4, 900);
  });
  await step('jump', async () => {
    await caption('Jump to any step with the scrubber — pseudocode, candidates and witnesses stay in sync');
    await page.getByTestId('scrubber').fill('19');
    await wait(3500);
  });
  await step('example mode', async () => {
    await caption('Example mode: one step per training example');
    await page.getByRole('radio', { name: 'Example mode' }).click();
    await wait(1000);
    await page.getByRole('button', { name: 'Reset to the initial state' }).click();
    await wait(600);
    await next(3, 1000);
  });
  await step('play', async () => {
    await caption('Play the whole run at the speed you want');
    await page.getByRole('combobox', { name: 'Playback speed' }).selectOption('4');
    await page.getByRole('button', { name: 'Play' }).click();
    await page.getByTestId('step-counter').filter({ hasText: /^5 \/ 5$/ }).waitFor({ timeout: 15000 });
    await wait(1500);
  });

  // 3 — lattice diagrams, shown fullscreen
  const fs_ = async (on) => {
    const open = await page.evaluate(() => !!document.fullscreenElement);
    if (on && !open) { await page.getByRole('button', { name: 'Fullscreen' }).click(); await wait(1500); }
    if (!on && open) { await page.evaluate(() => document.exitFullscreen()); await wait(800); }
  };
  const fit = async () => { await page.getByRole('button', { name: 'Fit to view' }).click(); await wait(800); };
  await step('lattice sport', async () => {
    await page.getByTestId('reveal-button').click();
    await wait(800);
    await fs_(true);
    await fit();
    await caption('Version space of Sport, fullscreen: a real Hasse diagram — general on top, specific below');
    await wait(5000);
    await page.getByTestId('lattice-canvas').locator('[data-node]', { hasText: '⟨?, team, ?, national, ?⟩' }).click();
    await caption('Click a hypothesis: its consistency with every example, and the paths up and down');
    await wait(3500);
    await page.getByRole('button', { name: 'Close details' }).click();
    await fs_(false);
  });

  // 4 — other examples
  const pick = async (name) => {
    await page.getByRole('option', { name: new RegExp(`^${name}`) }).click();
    await wait(800);
    await page.getByRole('button', { name: 'Last step' }).click();
    await wait(800);
  };
  await step('birds', async () => {
    await pick('Birds');
    await fs_(true);
    await fit();
    await caption('Birds: interval constraints and a colour hierarchy — boundaries and sample hypotheses');
    await wait(5000);
    await fs_(false);
  });
  await step('branching', async () => {
    await pick('Shapes — wide');
    await fs_(true);
    await fit();
    await caption('Wide G boundary: 3 maximal hypotheses, 7 in the version space — laid out automatically');
    await wait(4500);
    await fs_(false);
  });
  await step('contradiction', async () => {
    await caption('Contradictory labels: the version space collapses to empty');
    await pick('Contradictory labels');
    await wait(3000);
  });

  // 5 — classification
  await step('classify', async () => {
    await pick('EnjoySport');
    await page.getByRole('button', { name: 'Classify' }).click();
    await caption('Classify new instances: positive, negative or undetermined — with exact votes');
    for (const s of ['Slide 86 — A', 'Slide 87 — B', 'Slide 87 — D']) {
      await page.getByRole('button', { name: s }).click();
      await wait(2000);
    }
  });

  // 6 — new data: import + editor
  await step('import', async () => {
    await caption('Create new data: drag-and-drop CSV / Excel / JSON import with a wizard');
    await page.getByRole('button', { name: 'Dataset' }).click();
    await wait(1500);
    await page.getByTestId('file-input').setInputFiles(CSV);
    await wait(2500);
    await page.getByTestId('import-create').click();
    await page.getByTestId('dataset-title').waitFor();
    await wait(1500);
  });
  await step('editor', async () => {
    await caption('Edit attributes, domains and examples — errors are validated live');
    await page.getByRole('button', { name: 'Dataset' }).click();
    await wait(1500);
    const values = page.getByTestId('attr-1').getByLabel('Values (comma separated)');
    await values.fill('team');
    await wait(2500);
    await values.fill('team, individual');
    await wait(1000);
    await page.getByTestId('add-example').click();
    await caption('Add a new example, apply — the run is recomputed instantly');
    await wait(2000);
    await page.getByTestId('apply-dataset').click();
    await wait(1500);
    await page.getByRole('button', { name: 'Last step' }).click();
    await wait(3000);
  });

  // 7 — exports
  await step('export', async () => {
    await caption('Exports: JSON, CSV, lattice SVG / PNG and a PDF step-by-step report');
    await page.getByRole('button', { name: 'Export' }).click();
    await wait(3000);
    await page.keyboard.press('Escape');
  });

  // 8 — presentation
  await step('presentation', async () => {
    await caption('Presentation mode: a guided fullscreen demo driven by the real trace');
    await page.getByRole('button', { name: 'Present to the class' }).click();
    await page.getByTestId('presentation').waitFor();
    for (let i = 0; i < 9; i++) { await wait(650); await page.getByTestId('scene-next').click(); }
    await wait(2500);
  });

  const video = page.video();
  await ctx.close();
  await video.saveAs(path.join(OUT, 'demo.webm')); log('saved ' + fs.statSync(path.join(OUT, 'demo.webm')).size);
  await browser.close();
})();
