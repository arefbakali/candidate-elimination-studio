'use client';

import * as React from 'react';
import { formatCell, formatHypothesis, hKey, PSEUDOCODE, type CEResult, type Dataset, type Hypothesis, type TraceStep } from '@/lib/ce';
import { cn } from '@/lib/utils';
import { Badge, Panel, PanelHeader, Segmented } from '@/components/ui/primitives';
import { CheckIcon, XIcon } from '@/components/ui/icons';
import { HypothesisText } from './Hypothesis';
import { useStudio } from '@/store/studio';

// ───────────────────────── training table ─────────────────────────

export function TrainingTable({ dataset, result, step }: { dataset: Dataset; result: CEResult; step: TraceStep }) {
  const setStep = useStudio((s) => s.setStep);
  const current = step.exampleIndex;
  const done = step.phase === 'result' ? current : current - 1;
  return (
    <Panel className="flex min-h-0 flex-col">
      <PanelHeader title="Training examples" hint={`${dataset.examples.length} examples · processed in this order`} />
      <div className="thin-scroll min-h-0 overflow-auto">
        <table className="w-full border-collapse text-xs" data-testid="training-table">
          <thead className="sticky top-0 z-[1] bg-panel">
            <tr className="text-left text-muted">
              <th className="px-3 py-2 font-medium">#</th>
              {dataset.attributes.map((a) => (
                <th key={a.name} className="px-2 py-2 font-medium whitespace-nowrap">
                  {a.name}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">c(x)</th>
            </tr>
          </thead>
          <tbody>
            {dataset.examples.map((ex, i) => {
              const isCur = i === current;
              const isDone = i <= done;
              const resultStep = result.steps.find((s) => s.exampleIndex === i && s.phase === 'result');
              return (
                <tr
                  key={`${ex.id}-${i}`}
                  aria-current={isCur ? 'step' : undefined}
                  onClick={() => resultStep && setStep(resultStep.index)}
                  title="Jump to the state after this example"
                  className={cn(
                    'cursor-pointer border-t border-line transition-colors',
                    isCur ? 'bg-indigo/15' : 'hover:bg-panel-2',
                    !isDone && !isCur && 'text-faint',
                  )}
                >
                  <td className={cn('px-3 py-1.5 font-mono', isCur && 'text-cyan')}>
                    {isCur ? '▸ ' : ''}
                    {i + 1}
                  </td>
                  {ex.values.map((v, j) => (
                    <td key={j} className="px-2 py-1.5 font-mono whitespace-nowrap">
                      {v === null ? <span className="text-amber">missing</span> : String(v)}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right">
                    <Badge tone={ex.label ? 'pos' : 'neg'}>{ex.label ? '+ 1' : '− 0'}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ───────────────────────── step explanation ─────────────────────────

const phaseName: Record<TraceStep['phase'], string> = {
  init: 'Initialise',
  present: 'Read example',
  filter: 'Remove inconsistent',
  select: 'Find inconsistent',
  generate: 'Generate candidates',
  'filter-candidates': 'Filter candidates',
  prune: 'Remove redundant',
  result: 'Updated version space',
};

export function StepPanel({ dataset, result, step }: { dataset: Dataset; result: CEResult; step: TraceStep }) {
  const explain = useStudio((s) => s.explain);
  const setExplain = useStudio((s) => s.setExplain);
  const ex = step.exampleIndex >= 0 ? result.details[step.exampleIndex].example : null;
  return (
    <Panel className="flex min-h-0 flex-col" data-testid="step-panel">
      <PanelHeader
        title={
          <span className="flex items-center gap-2">
            <span className="text-faint">Step {step.index}</span>
            <span>{step.title}</span>
          </span>
        }
      >
        <Segmented
          size="sm"
          label="Explanation style"
          value={explain}
          onChange={setExplain}
          options={[
            { value: 'simple', label: 'Plain' },
            { value: 'formal', label: 'Formal' },
          ]}
        />
      </PanelHeader>
      <div className="thin-scroll min-h-0 space-y-3 overflow-auto p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="indigo">{phaseName[step.phase]}</Badge>
          {ex ? (
            <>
              <Badge tone={ex.label ? 'pos' : 'neg'}>{ex.label ? 'positive example' : 'negative example'}</Badge>
              <span className="font-mono text-xs text-muted">
                x{step.exampleIndex + 1} = ({ex.values.map(formatCell).join(', ')})
              </span>
            </>
          ) : null}
          {step.target ? <Badge tone={step.target === 'S' ? 's' : 'g'}>acting on {step.target}</Badge> : null}
        </div>
        <p key={`${step.index}-${explain}`} className={cn('fade-in leading-relaxed', explain === 'formal' ? 'font-mono text-[12.5px] text-fg' : 'text-fg')} data-testid="step-explanation">
          {explain === 'formal' ? step.formal : step.simple}
        </p>
        {step.checks && (step.phase === 'filter' || step.phase === 'select') ? (
          <div>
            <h3 className="mb-1.5 text-xs font-medium text-muted">Consistency checks on {step.target}</h3>
            <ul className="space-y-1">
              {step.checks.map((c) => (
                <li key={hKey(c.h)} className="flex items-center gap-2 text-xs">
                  {c.consistent ? <CheckIcon size={14} className="shrink-0 text-s" /> : <XIcon size={14} className="shrink-0 text-danger" />}
                  <HypothesisText h={c.h} attributes={dataset.attributes} />
                  <span className="ml-auto shrink-0 text-muted">{c.covers ? 'covers x' : 'rejects x'}</span>
                </li>
              ))}
              {step.checks.length === 0 ? <li className="text-xs text-faint">{step.target} is empty.</li> : null}
            </ul>
          </div>
        ) : null}
        {step.candidates ? <CandidateList step={step} dataset={dataset} /> : null}
        {step.pruned && step.pruned.length > 0 ? (
          <div>
            <h3 className="mb-1.5 text-xs font-medium text-muted">Redundant members</h3>
            <ul className="space-y-1">
              {step.pruned.map((p) => (
                <li key={hKey(p.h)} className="text-xs">
                  <HypothesisText h={p.h} attributes={dataset.attributes} className="text-danger line-through" />
                  <span className="text-muted"> {step.target === 'S' ? '≻' : '≺'} </span>
                  <HypothesisText h={p.dominatedBy} attributes={dataset.attributes} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <VarsTable vars={step.vars} />
      </div>
    </Panel>
  );
}

function CandidateList({ step, dataset }: { step: TraceStep; dataset: Dataset }) {
  const cands = step.candidates!;
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-medium text-muted">
        {step.target === 'S' ? 'Minimal generalisations' : 'Minimal specialisations'} ({cands.length})
      </h3>
      <ul className="space-y-1" data-testid="candidates">
        {cands.map((c, i) => (
          <li
            key={`${hKey(c.h)}-${i}`}
            className={cn(
              'flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border px-2 py-1 text-xs',
              c.status === 'kept' ? 'border-s/30 bg-s/5' : c.status === 'rejected' ? 'border-danger/25 bg-danger/5' : 'border-line',
            )}
          >
            <HypothesisText h={c.h} attributes={dataset.attributes} highlight={c.attr !== undefined && c.attr >= 0 ? [c.attr] : undefined} className={cn(c.status === 'rejected' && 'opacity-60')} />
            <span className="ml-auto text-[11px]">
              {c.status === 'pending' ? (
                <span className="text-muted">from {formatHypothesis(c.from)}</span>
              ) : c.status === 'kept' ? (
                <span className="text-s">kept · {step.target === 'S' ? '⪯' : '⪰'} {formatHypothesis(c.witness!)}</span>
              ) : (
                <span className="text-danger">rejected · no {step.target === 'S' ? 'g ∈ G is more general' : 's ∈ S is more specific'}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VarsTable({ vars }: { vars: Record<string, string> }) {
  const entries = Object.entries(vars);
  if (entries.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-medium text-muted">Variables</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border border-line bg-panel-2/50 p-2 font-mono text-[11.5px]">
        {entries.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt className={cn(k === 'S' ? 'text-s' : k === 'G' ? 'text-g' : 'text-cyan')}>{k}</dt>
            <dd className="break-words text-fg">{v}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}

// ───────────────────────── pseudocode ─────────────────────────

export function PseudocodePanel({ step }: { step: TraceStep }) {
  const explain = useStudio((s) => s.explain);
  return (
    <Panel className="flex min-h-0 flex-col" data-testid="pseudocode">
      <PanelHeader title="Candidate Elimination" hint="Course pseudocode, slide 74" />
      <ol className="thin-scroll min-h-0 overflow-auto py-2 font-mono text-[11.5px] leading-relaxed">
        {PSEUDOCODE.map((l) => {
          const active = step.lines.includes(l.n);
          return (
            <li
              key={l.n}
              data-active={active || undefined}
              className={cn('relative flex gap-2 py-0.5 pr-3 transition-colors', active ? 'bg-indigo/15 text-fg' : 'text-muted')}
            >
              <span className={cn('absolute inset-y-0 left-0 w-0.5', active ? 'bg-cyan' : 'bg-transparent')} />
              <span className="w-7 shrink-0 text-right text-faint">{l.n}</span>
              <span style={{ paddingLeft: l.indent * 14 }}>{explain === 'formal' ? l.formal : l.text}</span>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

// ───────────────────────── boundaries ─────────────────────────

function BoundaryList({ set, hs, prev, added, removed, dataset }: { set: 'S' | 'G'; hs: readonly Hypothesis[]; prev: readonly Hypothesis[]; added: Set<string>; removed: Hypothesis[]; dataset: Dataset }) {
  const selected = useStudio((s) => s.selectedNode);
  const select = useStudio((s) => s.selectNode);
  const prevKeys = new Set(prev.map(hKey));
  const shownRemoved = removed.filter((r) => prevKeys.has(hKey(r)) && !hs.some((h) => hKey(h) === hKey(r)));
  return (
    <ul className="space-y-1.5" data-testid={`boundary-${set}`}>
      {hs.map((h) => {
        const k = hKey(h);
        const isNew = added.has(k) || !prevKeys.has(k);
        return (
          <li key={k}>
            <button
              type="button"
              onClick={() => select(selected === k ? null : k)}
              className={cn(
                'w-full cursor-pointer rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors',
                set === 'S' ? 'border-s/40 bg-s/8 hover:bg-s/12' : 'border-g/40 bg-g/8 hover:bg-g/12',
                selected === k && 'ring-2 ring-cyan',
                isNew && 'fade-in',
              )}
            >
              <HypothesisText h={h} attributes={dataset.attributes} />
              {isNew ? <span className={cn('ml-2 text-[10px]', set === 'S' ? 'text-s' : 'text-g')}>new</span> : null}
            </button>
          </li>
        );
      })}
      {shownRemoved.map((h) => (
        <li key={`rm-${hKey(h)}`} className="fade-in rounded-lg border border-dashed border-danger/40 px-2.5 py-1.5 text-xs text-danger/80">
          <HypothesisText h={h} attributes={dataset.attributes} className="line-through" /> <span className="text-[10px]">removed</span>
        </li>
      ))}
      {hs.length === 0 ? <li className="rounded-lg border border-dashed border-danger/50 px-2.5 py-2 text-xs text-danger">∅ — empty boundary</li> : null}
    </ul>
  );
}

export function BoundaryTracker({ dataset, result, step }: { dataset: Dataset; result: CEResult; step: TraceStep }) {
  const prevStep = step.index > 0 ? result.steps[step.index - 1] : step;
  const added = new Set(step.added.map(hKey));
  const n = step.exampleIndex + (step.phase === 'result' ? 1 : 0);
  const sub = (i: number) => String(i).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]);
  const label = step.phase === 'result' || step.phase === 'init' ? sub(Math.max(0, n)) : '';
  return (
    <Panel className="flex min-h-0 flex-col">
      <PanelHeader title="Boundaries" hint={step.phase === 'result' || step.phase === 'init' ? `After example ${Math.max(0, n)}` : 'Intermediate state during the update'} />
      <div className="thin-scroll min-h-0 space-y-3 overflow-auto p-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-g">G{label} · most general</span>
            <span className="font-mono text-[11px] text-muted">|G| = {step.G.length}</span>
          </div>
          <BoundaryList set="G" hs={step.G} prev={prevStep.G} added={added} removed={step.target === 'G' ? step.removed : []} dataset={dataset} />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-s">S{label} · most specific</span>
            <span className="font-mono text-[11px] text-muted">|S| = {step.S.length}</span>
          </div>
          <BoundaryList set="S" hs={step.S} prev={prevStep.S} added={added} removed={step.target === 'S' ? step.removed : []} dataset={dataset} />
        </div>
      </div>
    </Panel>
  );
}
