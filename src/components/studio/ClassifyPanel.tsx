'use client';

import * as React from 'react';
import { classifyWithVersionSpace, covers, formatConstraint, hKey, type Cell } from '@/lib/ce';
import { cn } from '@/lib/utils';
import { Badge, Panel, PanelHeader, Segmented } from '@/components/ui/primitives';
import { getVS, useStudio } from '@/store/studio';
import { HypothesisText } from './Hypothesis';

const input = 'h-9 w-full rounded-md border border-line bg-panel-2 px-2 text-sm text-fg focus:border-indigo focus:outline-none';

const verdictStyle = {
  positive: { tone: 'border-s/50 bg-s/10 text-s', title: 'Definitely positive' },
  negative: { tone: 'border-danger/50 bg-danger/10 text-danger', title: 'Definitely negative' },
  undetermined: { tone: 'border-amber/50 bg-amber/10 text-amber', title: 'Undetermined' },
  'no-hypothesis': { tone: 'border-line-strong bg-panel-2 text-muted', title: 'No consistent hypothesis available' },
} as const;

export function ClassifyPanel() {
  const dataset = useStudio((s) => s.dataset);
  const space = useStudio((s) => s.space);
  const result = useStudio((s) => s.result);
  const step = useStudio((s) => s.step);
  const [which, setWhich] = React.useState<'final' | 'current'>('final');
  const [x, setX] = React.useState<Cell[]>(() => dataset.testInstances?.[0]?.values ?? dataset.examples[0]?.values ?? dataset.attributes.map(() => null));

  React.useEffect(() => {
    setX(dataset.testInstances?.[0]?.values ?? dataset.examples[0]?.values ?? dataset.attributes.map(() => null));
  }, [dataset]);

  if (!space || !result) return null;
  const st = result.steps[step];
  const b = which === 'final' ? result.final : { S: st.S, G: st.G };
  const vs = getVS(dataset, space, b.S, b.G);
  const invalid = x.map((v, i) => space.lattices[i].validateValue(v)).filter(Boolean) as string[];
  const res = invalid.length === 0 ? classifyWithVersionSpace(space, b, x, vs) : null;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(320px,420px)_1fr]" data-testid="classify">
      <Panel>
        <PanelHeader title="New instance" hint="Classified by the whole version space, not by a single hypothesis" />
        <div className="space-y-3 p-4">
          <Segmented
            label="Boundaries used"
            value={which}
            onChange={setWhich}
            options={[
              { value: 'final', label: 'After all examples' },
              { value: 'current', label: `At simulator step ${step}` },
            ]}
          />
          {dataset.attributes.map((a, i) => (
            <label key={a.name} className="block text-xs text-muted">
              {a.name}
              {a.kind === 'categorical' ? (
                <select className={cn(input, 'mt-1 font-mono')} value={x[i] === null ? '__m' : String(x[i])} onChange={(e) => setX((v) => v.map((c, j) => (j === i ? (e.target.value === '__m' ? null : e.target.value) : c)))} aria-label={a.name}>
                  {a.values.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                  <option value="__m">missing</option>
                </select>
              ) : (
                <input
                  className={cn(input, 'mt-1 font-mono')}
                  type="number"
                  step={a.step}
                  aria-label={a.name}
                  value={x[i] === null ? '' : String(x[i])}
                  onChange={(e) => setX((v) => v.map((c, j) => (j === i ? (e.target.value === '' ? null : Number(e.target.value)) : c)))}
                />
              )}
            </label>
          ))}
          {dataset.testInstances?.length ? (
            <div>
              <p className="mb-1 text-xs text-muted">Try an instance</p>
              <div className="flex flex-wrap gap-1.5">
                {dataset.testInstances.map((t) => (
                  <button key={t.label} type="button" onClick={() => setX(t.values)} className="cursor-pointer rounded-md border border-line px-2 py-1 text-[11px] text-muted hover:border-line-strong hover:text-fg">
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Panel>
      <div className="space-y-4">
        {invalid.length ? (
          <Panel className="p-4 text-sm text-danger">{invalid.join('. ')}</Panel>
        ) : res ? (
          <Panel className={cn('border p-5', verdictStyle[res.verdict].tone)} data-testid="verdict" data-verdict={res.verdict}>
            <p className="text-xl font-semibold">{verdictStyle[res.verdict].title}</p>
            <p className="mt-1 text-sm text-fg/90">{res.reason}</p>
            {res.exactVotes ? (
              <p className="mt-3 text-sm text-fg">
                Exact count over the {res.exactVotes.total} hypotheses of the version space: <b className="text-s">{res.exactVotes.positive} positive</b> · <b className="text-danger">{res.exactVotes.negative} negative</b>.
                {res.verdict === 'undetermined' ? ' These are counts, not probabilities: hypotheses are not weighted.' : ''}
              </p>
            ) : vs.status === 'infinite' ? (
              <p className="mt-3 text-sm text-muted">The version space is infinite, so only the boundary test above applies.</p>
            ) : null}
          </Panel>
        ) : null}
        {res ? (
          <Panel>
            <PanelHeader title="Constraint by constraint" hint="Supporting hypotheses: every member of S, every member of G" />
            <div className="thin-scroll overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="px-3 py-2 font-medium">Boundary</th>
                    {dataset.attributes.map((a) => (
                      <th key={a.name} className="px-2 py-2 font-medium">
                        {a.name}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right font-medium">h(x)</th>
                  </tr>
                </thead>
                <tbody>
                  {res.boundaryVotes.map((v) => (
                    <tr key={`${v.set}-${hKey(v.h)}`} className="border-t border-line">
                      <td className="px-3 py-1.5">
                        <Badge tone={v.set === 'S' ? 's' : 'g'}>{v.set}</Badge>
                      </td>
                      {v.h.map((c, i) => (
                        <td key={i} className={cn('px-2 py-1.5 font-mono', v.checks[i].satisfied ? (c.t === 'any' ? 'text-faint' : 'text-s') : 'text-danger')}>
                          {v.checks[i].satisfied ? '✓ ' : '✗ '}
                          {formatConstraint(c)}
                        </td>
                      ))}
                      <td className={cn('px-3 py-1.5 text-right font-medium', v.covers ? 'text-s' : 'text-danger')}>{v.covers ? '1' : '0'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : null}
        {res && vs.status === 'complete' && vs.count <= 64 ? (
          <Panel>
            <PanelHeader title="Every hypothesis of the version space" hint={`${vs.count} hypotheses`} />
            <ul className="grid gap-1 p-3 md:grid-cols-2">
              {vs.hypotheses.map((h) => {
                const c = covers(space, h, x);
                return (
                  <li key={hKey(h)} className={cn('flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-xs', c ? 'border-s/30' : 'border-danger/25')}>
                    <HypothesisText h={h} attributes={dataset.attributes} />
                    <span className={c ? 'text-s' : 'text-danger'}>{c ? '+' : '−'}</span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
