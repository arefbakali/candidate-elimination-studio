'use client';

import * as React from 'react';
import { Panel, PanelHeader } from '@/components/ui/primitives';
import { getVS, useStudio } from '@/store/studio';

function Tile({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-medium ${tone ?? 'text-fg'}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-faint">{sub}</div> : null}
    </div>
  );
}

interface Series {
  name: string;
  color: string;
  values: (number | null)[];
}

/** Small multi-series line chart; `log` uses log10(1 + y). */
function LineChart({ series, labels, log, height = 180, yLabel }: { series: Series[]; labels: string[]; log?: boolean; height?: number; yLabel: string }) {
  const W = 560;
  const H = height;
  const pad = { l: 44, r: 12, t: 12, b: 26 };
  const tf = (v: number) => (log ? Math.log10(1 + v) : v);
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null)).map(tf);
  const max = Math.max(1, ...all);
  const x = (i: number) => pad.l + (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - tf(v) / max) * (H - pad.t - pad.b);
  const ticks = log
    ? [1, 10, 100, 1000, 10000, 100000].filter((t) => tf(t) <= max * 1.001)
    : max <= 8
      ? Array.from({ length: Math.ceil(max) + 1 }, (_, k) => k)
      : [0, Math.round(max / 2), Math.round(max)];
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={yLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--faint)" className="font-mono">
              {t}
            </text>
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={l} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--faint)" className="font-mono">
            {l}
          </text>
        ))}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v === null ? null : ([x(i), y(v)] as const)));
          const d = pts.reduce((acc, p, i) => (p ? `${acc}${acc === '' || !pts[i - 1] ? 'M' : 'L'}${p[0]},${p[1]} ` : acc), '');
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth="2" />
              {pts.map((p, i) => (p ? <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={s.color} /> : null))}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
        {log ? <span className="text-faint">log scale</span> : null}
      </figcaption>
    </figure>
  );
}

export function AnalyticsPanel() {
  const dataset = useStudio((s) => s.dataset);
  const space = useStudio((s) => s.space);
  const result = useStudio((s) => s.result);
  const stepIdx = useStudio((s) => s.step);
  if (!space || !result) return null;
  const st = result.steps[stepIdx];
  const processed = st.phase === 'result' ? st.exampleIndex + 1 : Math.max(0, st.exampleIndex);
  const exs = dataset.examples.slice(0, processed);
  const stats = result.stats.slice(0, processed);
  const vsNow = getVS(dataset, space, st.S, st.G);
  const vsSeries = result.history.map((b) => {
    const v = getVS(dataset, space, b.S, b.G);
    return v.status === 'complete' || v.status === 'empty' ? v.count : null;
  });
  const anyUnknown = vsSeries.some((v) => v === null);
  const labels = result.history.map((_, i) => String(i));
  const generated = stats.reduce((a, s) => a + s.generated, 0);
  const eliminated = stats.reduce((a, s) => a + s.removed + s.rejected + s.pruned, 0);
  const ms = stats.reduce((a, s) => a + s.ms, 0);

  return (
    <div className="space-y-4" data-testid="analytics">
      <p className="text-xs text-muted">Figures below are read from the current simulator step (step {stepIdx}); charts cover the whole run. Every value is computed from the algorithm&apos;s execution.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Tile label="Processed" value={`${processed}/${dataset.examples.length}`} sub="examples" />
        <Tile label="Positive" value={exs.filter((e) => e.label).length} tone="text-s" />
        <Tile label="Negative" value={exs.filter((e) => !e.label).length} tone="text-danger" />
        <Tile label="|S|" value={st.S.length} tone="text-s" />
        <Tile label="|G|" value={st.G.length} tone="text-g" />
        <Tile label="|VS|" value={vsNow.status === 'complete' ? vsNow.count.toLocaleString() : vsNow.status === 'empty' ? '0' : vsNow.status === 'infinite' ? '∞' : `>${vsNow.count.toLocaleString()}`} sub={vsNow.status === 'complete' ? 'exact' : vsNow.status === 'infinite' ? 'unbounded intervals' : vsNow.status === 'empty' ? 'collapsed' : 'not enumerated'} tone="text-cyan" />
        <Tile label="Generated" value={generated} sub={`${eliminated} eliminated`} />
        <Tile label="Time" value={`${ms.toFixed(ms < 10 ? 2 : 0)}`} sub={`ms · full run ${result.totalMs.toFixed(1)} ms`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Version space size" hint="Exact |VS| after each example" />
          <div className="p-4">
            {anyUnknown && vsSeries.every((v) => v === null) ? (
              <p className="text-sm text-muted">The version space cannot be enumerated for this dataset (infinite or too large); see the boundary sizes instead.</p>
            ) : (
              <LineChart series={[{ name: '|VS|', color: 'var(--cyan)', values: vsSeries }]} labels={labels} log yLabel="Version space size per example" />
            )}
            {anyUnknown && !vsSeries.every((v) => v === null) ? <p className="mt-1 text-[11px] text-faint">Gaps: the version space was infinite or too large to enumerate at that point.</p> : null}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Boundary sizes" hint="|S| and |G| after each example" />
          <div className="p-4">
            <LineChart
              series={[
                { name: '|G|', color: 'var(--g)', values: result.history.map((b) => b.G.length) },
                { name: '|S|', color: 'var(--s)', values: result.history.map((b) => b.S.length) },
              ]}
              labels={labels}
              yLabel="Boundary sizes per example"
            />
          </div>
        </Panel>
        <Panel className="xl:col-span-2">
          <PanelHeader title="Work per example" hint="Candidates generated, rejected by the other boundary, inconsistent members removed, redundant members pruned" />
          <div className="thin-scroll overflow-x-auto p-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted">
                  {['Example', 'Label', 'Generated', 'Rejected', 'Removed', 'Pruned', '|S|', '|G|', 'Time (ms)'].map((h) => (
                    <th key={h} className="px-2 py-1.5 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.stats.map((s) => (
                  <tr key={s.exampleIndex} className={`border-t border-line font-mono ${s.exampleIndex >= processed ? 'text-faint' : ''}`}>
                    <td className="px-2 py-1">x{s.exampleIndex + 1}</td>
                    <td className={`px-2 py-1 ${s.label ? 'text-s' : 'text-danger'}`}>{s.label ? '+' : '−'}</td>
                    <td className="px-2 py-1">
                      <Bar n={s.generated} max={Math.max(1, ...result.stats.map((x) => x.generated))} color="var(--indigo)" />
                    </td>
                    <td className="px-2 py-1">{s.rejected}</td>
                    <td className="px-2 py-1">{s.removed}</td>
                    <td className="px-2 py-1">{s.pruned}</td>
                    <td className="px-2 py-1 text-s">{s.sizeS}</td>
                    <td className="px-2 py-1 text-g">{s.sizeG}</td>
                    <td className="px-2 py-1">{s.ms.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Bar({ n, max, color }: { n: number; max: number; color: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="inline-block h-1.5 rounded-full" style={{ width: `${Math.max(2, (n / max) * 80)}px`, background: color }} />
      {n}
    </span>
  );
}
