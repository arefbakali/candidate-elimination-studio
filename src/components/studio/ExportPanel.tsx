'use client';

import * as React from 'react';
import { buildLattice } from '@/lib/ce';
import { historyCsv, historyRows, latticeSvg, reportPdf, resultJson } from '@/lib/export/report';
import { serializeDataset } from '@/lib/io/schema';
import { elkLayout } from '@/lib/layout';
import { downloadBlob } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Panel, PanelHeader } from '@/components/ui/primitives';
import { DownloadIcon } from '@/components/ui/icons';
import { useStudio } from '@/store/studio';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dataset';

async function svgToPng(svg: string): Promise<Blob> {
  const m = /width="([\d.]+)" height="([\d.]+)"/.exec(svg);
  const w = m ? Number(m[1]) : 800;
  const h = m ? Number(m[2]) : 600;
  const scale = 2;
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not render the SVG.'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w * scale);
    canvas.height = Math.ceil(h * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed.'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ExportPanel() {
  const dataset = useStudio((s) => s.dataset);
  const space = useStudio((s) => s.space);
  const result = useStudio((s) => s.result);
  const theme = useStudio((s) => s.theme);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  if (!space || !result) return null;
  const name = slug(dataset.name);

  const finalSvg = async () => {
    const lat = buildLattice(space, result.final, { samples: dataset.sampleHypotheses, maxNodes: 120 });
    const boxes = await elkLayout(lat);
    return latticeSvg(lat, boxes, { dark: theme === 'dark', title: `${dataset.name} — final version space` });
  };

  const run = async (key: string, fn: () => Promise<void> | void) => {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
      setMessage(`Downloaded ${key}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const items: { key: string; title: string; desc: string; fn: () => Promise<void> | void }[] = [
    {
      key: `${name}-result.json`,
      title: 'Algorithm results (JSON)',
      desc: 'Final S and G, the enumerated version space, every trace step with its explanation, and per-example statistics.',
      fn: () => downloadBlob(JSON.stringify(resultJson(dataset, space, result), null, 2), `${name}-result.json`, 'application/json'),
    },
    {
      key: `${name}-history.csv`,
      title: 'S / G history (CSV)',
      desc: 'One row per state S₀…Sₙ, G₀…Gₙ with boundary and version space sizes.',
      fn: () => downloadBlob(historyCsv(space, result), `${name}-history.csv`, 'text/csv'),
    },
    {
      key: `${name}-history.json`,
      title: 'S / G history (JSON)',
      desc: 'The same history as structured JSON.',
      fn: () => downloadBlob(JSON.stringify(historyRows(space, result), null, 2), `${name}-history.json`, 'application/json'),
    },
    {
      key: `${name}-lattice.svg`,
      title: 'Final lattice (SVG)',
      desc: 'Vector drawing of the final version space with the same layout as the studio.',
      fn: async () => downloadBlob(await finalSvg(), `${name}-lattice.svg`, 'image/svg+xml'),
    },
    {
      key: `${name}-lattice.png`,
      title: 'Final lattice (PNG)',
      desc: 'High-resolution image (2×) of the final version space.',
      fn: async () => downloadBlob(await svgToPng(await finalSvg()), `${name}-lattice.png`, 'image/png'),
    },
    {
      key: `${name}-report.pdf`,
      title: 'Step-by-step report (PDF)',
      desc: 'Hypothesis language, examples, pseudocode, every processing step with its explanation, and the final version space.',
      fn: () => downloadBlob(reportPdf(dataset, space, result), `${name}-report.pdf`, 'application/pdf'),
    },
    {
      key: `${name}-dataset.json`,
      title: 'Dataset (JSON)',
      desc: 'Re-importable dataset file with attributes, domains and examples.',
      fn: () => downloadBlob(JSON.stringify(serializeDataset(dataset), null, 2), `${name}-dataset.json`, 'application/json'),
    },
  ];

  return (
    <Panel data-testid="export">
      <PanelHeader title="Export" hint="Every file is generated from the run currently shown in the studio" />
      <ul className="divide-y divide-line">
        {items.map((it) => (
          <li key={it.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="mr-auto min-w-0 max-w-2xl">
              <p className="text-sm font-medium text-fg">{it.title}</p>
              <p className="text-xs text-muted">{it.desc}</p>
            </div>
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run(it.key, it.fn)} data-testid={`export-${it.key.split('.').pop()}-${it.key.includes('history') ? 'history' : it.key.includes('lattice') ? 'lattice' : it.key.includes('dataset') ? 'dataset' : 'main'}`}>
              <DownloadIcon size={14} /> {busy === it.key ? 'Preparing…' : 'Download'}
            </Button>
          </li>
        ))}
      </ul>
      {message ? (
        <p className="border-t border-line px-4 py-2 text-xs text-muted" role="status">
          {message}
        </p>
      ) : null}
    </Panel>
  );
}
