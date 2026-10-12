'use client';

import * as React from 'react';
import { hKey, type CEResult, type Dataset, type Hypothesis, type TraceStep } from '@/lib/ce';
import { cn } from '@/lib/utils';
import { Badge, Panel, PanelHeader } from '@/components/ui/primitives';
import { HypothesisText } from './Hypothesis';
import { useStudio } from '@/store/studio';

const sub = (i: number) => String(i).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]);

type Event = { kind: 'added' | 'removed' | 'generalised' | 'specialised'; set: 'S' | 'G'; n: number };

function eventsOf(r: CEResult, i: number): Event[] {
  const d = r.details[i];
  const out: Event[] = [];
  for (const u of d.updates) {
    const before = new Set(u.before.map(hKey));
    const after = new Set(u.after.map(hKey));
    const removed = u.before.filter((h) => !after.has(hKey(h))).length;
    const added = u.after.filter((h) => !before.has(hKey(h))).length;
    if (u.kind === 'refine' && u.removed.length > 0) out.push({ kind: u.set === 'S' ? 'generalised' : 'specialised', set: u.set, n: u.removed.length });
    else if (removed > 0) out.push({ kind: 'removed', set: u.set, n: removed });
    if (added > 0 && u.kind !== 'refine') out.push({ kind: 'added', set: u.set, n: added });
  }
  return out;
}

function diff(a: readonly Hypothesis[], b: readonly Hypothesis[]) {
  const ka = new Set(a.map(hKey));
  const kb = new Set(b.map(hKey));
  return { removed: a.filter((h) => !kb.has(hKey(h))), added: b.filter((h) => !ka.has(hKey(h))), kept: b.filter((h) => ka.has(hKey(h))) };
}

export function HistoryTimeline({ dataset, result, step }: { dataset: Dataset; result: CEResult; step: TraceStep }) {
  const setStep = useStudio((s) => s.setStep);
  const compareWith = useStudio((s) => s.compareWith);
  const setCompare = useStudio((s) => s.setCompareWith);
  const reached = step.phase === 'result' ? step.exampleIndex + 1 : step.exampleIndex < 0 ? 0 : step.exampleIndex;
  const scroller = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = scroller.current;
    const card = el?.querySelector<HTMLElement>(`[data-state="${reached}"]`);
    if (!el || !card) return;
    const left = card.offsetLeft - el.clientWidth / 2 + card.clientWidth / 2;
    el.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [reached]);
  const goTo = (i: number) => {
    const idx = i === 0 ? 0 : result.steps.find((s) => s.exampleIndex === i - 1 && s.phase === 'result')!.index;
    setStep(idx);
  };
  return (
    <Panel className="flex min-h-0 flex-col" data-testid="history">
      <PanelHeader title="Boundary history" hint="S₀ … Sₙ and G₀ … Gₙ. Select an example to compare the state before and after it." />
      <div ref={scroller} className="thin-scroll relative overflow-x-auto">
        <div className="flex min-w-max gap-2 p-3">
          {result.history.map((b, i) => {
            const ev = i > 0 ? eventsOf(result, i - 1) : [];
            const ex = i > 0 ? result.details[i - 1].example : null;
            const isCur = i === reached;
            return (
              <div key={i} data-state={i} className={cn('w-[230px] shrink-0 rounded-lg border p-2 text-[11px] transition-colors', isCur ? 'border-cyan/70 bg-cyan/5' : 'border-line', i > reached && 'opacity-45')}>
                <div className="mb-1 flex items-center justify-between gap-1">
                  <button type="button" onClick={() => goTo(i)} className="cursor-pointer font-semibold text-fg hover:text-cyan">
                    {i === 0 ? 'Initial state' : `After x${i}`}
                  </button>
                  {ex ? <Badge tone={ex.label ? 'pos' : 'neg'}>{ex.label ? '+' : '−'}</Badge> : null}
                </div>
                <div className="space-y-0.5">
                  <div className="truncate">
                    <span className="mr-1 font-semibold text-g">G{sub(i)}</span>
                    {b.G.length === 0 ? <span className="text-danger">∅</span> : b.G.map((h) => <HypothesisText key={hKey(h)} h={h} className="mr-1 block truncate" />)}
                  </div>
                  <div className="truncate">
                    <span className="mr-1 font-semibold text-s">S{sub(i)}</span>
                    {b.S.length === 0 ? <span className="text-danger">∅</span> : b.S.map((h) => <HypothesisText key={hKey(h)} h={h} className="mr-1 block truncate" />)}
                  </div>
                </div>
                {i > 0 ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {ev.length === 0 ? <span className="text-faint">no change</span> : null}
                    {ev.map((e, k) => (
                      <Badge key={k} tone={e.set === 'S' ? 's' : 'g'}>
                        {e.set} {e.kind}
                        {e.n > 1 ? ` ×${e.n}` : ''}
                      </Badge>
                    ))}
                    <button type="button" onClick={() => setCompare(compareWith === i ? null : i)} className={cn('ml-auto cursor-pointer text-[11px]', compareWith === i ? 'text-cyan' : 'text-muted hover:text-fg')} aria-pressed={compareWith === i}>
                      compare
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      {compareWith !== null && compareWith < result.history.length ? <Compare dataset={dataset} result={result} i={compareWith} onClose={() => setCompare(null)} /> : null}
    </Panel>
  );
}

function Compare({ dataset, result, i, onClose }: { dataset: Dataset; result: CEResult; i: number; onClose: () => void }) {
  const before = result.history[i - 1];
  const after = result.history[i];
  const rows = (['G', 'S'] as const).map((set) => ({ set, ...diff(before[set], after[set]) }));
  return (
    <div className="fade-in border-t border-line p-3 text-xs" data-testid="compare">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-fg">
          Before and after example {i} ({result.details[i - 1].example.label ? 'positive' : 'negative'})
        </span>
        <button type="button" className="cursor-pointer text-muted hover:text-fg" onClick={onClose}>
          close
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((r) => (
          <div key={r.set}>
            <div className={cn('mb-1 font-semibold', r.set === 'S' ? 'text-s' : 'text-g')}>
              {r.set}
              {sub(i - 1)} → {r.set}
              {sub(i)}
            </div>
            <ul className="space-y-0.5">
              {r.kept.map((h) => (
                <li key={`k${hKey(h)}`} className="text-muted">
                  = <HypothesisText h={h} attributes={dataset.attributes} />
                </li>
              ))}
              {r.removed.map((h) => (
                <li key={`r${hKey(h)}`} className="text-danger">
                  − <HypothesisText h={h} attributes={dataset.attributes} className="line-through" />
                </li>
              ))}
              {r.added.map((h) => (
                <li key={`a${hKey(h)}`} className="text-s">
                  + <HypothesisText h={h} attributes={dataset.attributes} />
                </li>
              ))}
              {r.kept.length + r.removed.length + r.added.length === 0 ? <li className="text-faint">∅ before and after</li> : null}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
