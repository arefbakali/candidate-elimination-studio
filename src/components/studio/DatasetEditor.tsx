'use client';

import * as React from 'react';
import type { AttributeSpec, Cell, Dataset, Example } from '@/lib/ce';
import { BUILTIN_DATASETS } from '@/lib/datasets';
import { loadFile, type Loaded } from '@/lib/io/load';
import { validateDataset } from '@/lib/io/schema';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge, Panel, PanelHeader } from '@/components/ui/primitives';
import { AlertIcon, DownIcon, InfoIcon, PlusIcon, TrashIcon, UpIcon, UploadIcon } from '@/components/ui/icons';
import { useStudio } from '@/store/studio';
import { ImportWizard } from './ImportWizard';

const input = 'h-8 rounded-md border border-line bg-panel-2 px-2 text-xs text-fg placeholder:text-faint focus:border-indigo focus:outline-none';

function parseBoundInput(s: string): number {
  const t = s.trim().toLowerCase();
  if (t === 'inf' || t === '+inf' || t === '∞' || t === '+∞') return Infinity;
  if (t === '-inf' || t === '-∞') return -Infinity;
  return Number(t);
}
const showBound = (x: number) => (x === Infinity ? '+inf' : x === -Infinity ? '-inf' : String(x));

function hierarchyToText(a: AttributeSpec): string {
  if (a.kind !== 'categorical' || !a.hierarchy) return '';
  return a.hierarchy.map((g) => `${g.name}: ${g.members.join(', ')}`).join('\n');
}

function textToHierarchy(t: string) {
  return t
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name, rest = ''] = l.split(':');
      return { name: name.trim(), members: rest.split(',').map((m) => m.trim()).filter(Boolean) };
    });
}

const splitValues = (s: string) => s.split(',').map((v) => v.trim()).filter(Boolean);

export function DatasetEditor() {
  const dataset = useStudio((s) => s.dataset);
  const setDataset = useStudio((s) => s.setDataset);
  const addDataset = useStudio((s) => s.addDataset);
  const setView = useStudio((s) => s.setView);
  const [draft, setDraft] = React.useState<Dataset>(dataset);
  const [valueText, setValueText] = React.useState<string[]>(() => dataset.attributes.map((a) => (a.kind === 'categorical' ? a.values.join(', ') : '')));
  const [hierText, setHierText] = React.useState<string[]>(() => dataset.attributes.map(hierarchyToText));
  const [loaded, setLoaded] = React.useState<Extract<Loaded, { kind: 'table' }> | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setDraft(dataset);
    setValueText(dataset.attributes.map((a) => (a.kind === 'categorical' ? a.values.join(', ') : '')));
    setHierText(dataset.attributes.map(hierarchyToText));
  }, [dataset]);

  const report = React.useMemo(() => validateDataset(draft), [draft]);
  const dirty = draft !== dataset;
  const original = BUILTIN_DATASETS.find((d) => d.id === dataset.id);

  const updateAttr = (i: number, a: AttributeSpec) => setDraft((d) => ({ ...d, attributes: d.attributes.map((x, j) => (j === i ? a : x)) }));
  const updateExample = (i: number, ex: Example) => setDraft((d) => ({ ...d, examples: d.examples.map((x, j) => (j === i ? ex : x)) }));

  const onFile = async (file: File) => {
    setLoadError(null);
    try {
      const res = await loadFile(file.name, await file.arrayBuffer());
      if (res.kind === 'dataset') {
        addDataset({ ...res.dataset, id: `${res.dataset.id}-${Date.now().toString(36)}` });
      } else setLoaded(res);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  };

  const changeKind = (i: number, kind: AttributeSpec['kind']) => {
    const a = draft.attributes[i];
    if (a.kind === kind) return;
    if (kind === 'interval') {
      const nums = draft.examples.map((e) => e.values[i]).filter((v): v is number => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)))).map(Number);
      setDraft((d) => ({
        ...d,
        attributes: d.attributes.map((x, j) => (j === i ? { kind: 'interval', name: a.name, min: nums.length ? Math.min(...nums) : 0, max: nums.length ? Math.max(...nums) : 10, step: 1 } : x)),
        examples: d.examples.map((e) => ({ ...e, values: e.values.map((v, j) => (j === i ? (v === null || Number.isNaN(Number(v)) ? null : Number(v)) : v)) })),
      }));
    } else {
      const vals = [...new Set(draft.examples.map((e) => e.values[i]).filter((v) => v !== null).map(String))];
      setValueText((t) => t.map((x, j) => (j === i ? vals.join(', ') : x)));
      setDraft((d) => ({
        ...d,
        attributes: d.attributes.map((x, j) => (j === i ? { kind: 'categorical', name: a.name, values: vals.length ? vals : ['a', 'b'] } : x)),
        examples: d.examples.map((e) => ({ ...e, values: e.values.map((v, j) => (j === i ? (v === null ? null : String(v)) : v)) })),
      }));
    }
  };

  return (
    <div className="space-y-4" data-testid="dataset-editor">
      <Panel>
        <PanelHeader title="Import a dataset" hint="CSV, Excel (.xlsx) or JSON — or edit the current dataset below" />
        <div className="p-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void onFile(f);
            }}
            className={cn('flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-7 text-center transition-colors', dragOver ? 'border-cyan bg-cyan/5' : 'border-line-strong')}
          >
            <UploadIcon size={22} className="text-muted" />
            <p className="text-sm text-fg">Drop a file here</p>
            <p className="text-xs text-muted">Columns become attributes; one column holds the class. You choose how each column is represented before running.</p>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              Choose a file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt,.xlsx,.xlsm,.json"
              className="hidden"
              data-testid="file-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = '';
              }}
            />
          </div>
          {loadError ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-danger" role="alert">
              <AlertIcon size={14} /> {loadError}
            </p>
          ) : null}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Hypothesis language" hint="Candidate Elimination searches conjunctions of one constraint per attribute.">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const name = `A${draft.attributes.length + 1}`;
              setValueText((t) => [...t, 'yes, no']);
              setHierText((t) => [...t, '']);
              setDraft((d) => ({ ...d, attributes: [...d.attributes, { kind: 'categorical', name, values: ['yes', 'no'] }], examples: d.examples.map((e) => ({ ...e, values: [...e.values, 'yes'] })) }));
            }}
          >
            <PlusIcon size={14} /> Attribute
          </Button>
        </PanelHeader>
        <div className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-3">
          {draft.attributes.map((a, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-line p-3" data-testid={`attr-${i}`}>
              <div className="flex items-center gap-2">
                <input className={cn(input, 'flex-1 font-medium')} value={a.name} aria-label={`Attribute ${i + 1} name`} onChange={(e) => updateAttr(i, { ...a, name: e.target.value })} />
                <select className={input} value={a.kind} aria-label={`Attribute ${i + 1} type`} onChange={(e) => changeKind(i, e.target.value as AttributeSpec['kind'])}>
                  <option value="categorical">categorical</option>
                  <option value="interval">interval</option>
                </select>
                <Button
                  size="iconSm"
                  variant="danger"
                  aria-label={`Remove attribute ${a.name}`}
                  disabled={draft.attributes.length <= 1}
                  onClick={() => {
                    setValueText((t) => t.filter((_, j) => j !== i));
                    setHierText((t) => t.filter((_, j) => j !== i));
                    setDraft((d) => ({ ...d, attributes: d.attributes.filter((_, j) => j !== i), examples: d.examples.map((e) => ({ ...e, values: e.values.filter((_, j) => j !== i) })), sampleHypotheses: undefined }));
                  }}
                >
                  <TrashIcon size={14} />
                </Button>
              </div>
              {a.kind === 'categorical' ? (
                <>
                  <label className="block text-[11px] text-muted">
                    Values (comma separated)
                    <input
                      className={cn(input, 'mt-1 w-full font-mono')}
                      value={valueText[i] ?? ''}
                      onChange={(e) => {
                        const t = e.target.value;
                        setValueText((v) => v.map((x, j) => (j === i ? t : x)));
                        updateAttr(i, { ...a, values: splitValues(t) });
                      }}
                    />
                  </label>
                  <label className="block text-[11px] text-muted">
                    Hierarchy (optional, one group per line: <span className="font-mono">warm: russet, orange</span>)
                    <textarea
                      className={cn(input, 'mt-1 h-14 w-full py-1 font-mono')}
                      value={hierText[i] ?? ''}
                      onChange={(e) => {
                        const t = e.target.value;
                        setHierText((v) => v.map((x, j) => (j === i ? t : x)));
                        const h = textToHierarchy(t);
                        updateAttr(i, { ...a, hierarchy: h.length ? h : undefined });
                      }}
                    />
                  </label>
                </>
              ) : (
                <div className="grid grid-cols-3 gap-2 text-[11px] text-muted">
                  {(['min', 'max', 'step'] as const).map((k) => (
                    <label key={k}>
                      {k}
                      <input
                        className={cn(input, 'mt-1 w-full font-mono')}
                        defaultValue={showBound(a[k])}
                        key={`${dataset.id}-${i}-${k}-${a[k]}`}
                        onBlur={(e) => {
                          const v = parseBoundInput(e.target.value);
                          if (!Number.isNaN(v)) updateAttr(i, { ...a, [k]: v });
                        }}
                      />
                    </label>
                  ))}
                  <p className="col-span-3 text-faint">Constraints are closed intervals [lo, hi] on the grid min + k·step. Use +inf for an unbounded side, as in [71, +∞[.</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Training examples" hint="The order matters for the trace (not for the final version space).">
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                examples: [...d.examples, { id: `x${d.examples.length + 1}`, values: d.attributes.map((a) => (a.kind === 'categorical' ? a.values[0] ?? null : Number.isFinite(a.min) ? a.min : 0)), label: true }],
              }))
            }
            data-testid="add-example"
          >
            <PlusIcon size={14} /> Example
          </Button>
        </PanelHeader>
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted">
                <th className="px-3 py-2 font-medium">#</th>
                {draft.attributes.map((a, i) => (
                  <th key={i} className="px-2 py-2 font-medium">
                    {a.name}
                  </th>
                ))}
                <th className="px-2 py-2 font-medium">Class</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {draft.examples.map((ex, r) => (
                <tr key={r} className="border-t border-line" data-testid={`example-row-${r}`}>
                  <td className="px-3 py-1.5 font-mono text-faint">{r + 1}</td>
                  {draft.attributes.map((a, i) => (
                    <td key={i} className="px-2 py-1">
                      <CellInput attr={a} value={ex.values[i]} onChange={(v) => updateExample(r, { ...ex, values: ex.values.map((x, j) => (j === i ? v : x)) })} label={`Example ${r + 1} ${a.name}`} />
                    </td>
                  ))}
                  <td className="px-2 py-1">
                    <button
                      type="button"
                      onClick={() => updateExample(r, { ...ex, label: !ex.label })}
                      className="cursor-pointer"
                      aria-label={`Example ${r + 1} label: ${ex.label ? 'positive' : 'negative'} (click to toggle)`}
                    >
                      <Badge tone={ex.label ? 'pos' : 'neg'}>{ex.label ? 'positive' : 'negative'}</Badge>
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1 text-right">
                    <Button size="iconSm" variant="ghost" aria-label={`Move example ${r + 1} up`} disabled={r === 0} onClick={() => setDraft((d) => ({ ...d, examples: move(d.examples, r, r - 1) }))}>
                      <UpIcon size={14} />
                    </Button>
                    <Button size="iconSm" variant="ghost" aria-label={`Move example ${r + 1} down`} disabled={r === draft.examples.length - 1} onClick={() => setDraft((d) => ({ ...d, examples: move(d.examples, r, r + 1) }))}>
                      <DownIcon size={14} />
                    </Button>
                    <Button size="iconSm" variant="danger" aria-label={`Delete example ${r + 1}`} onClick={() => setDraft((d) => ({ ...d, examples: d.examples.filter((_, j) => j !== r) }))}>
                      <TrashIcon size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel/95 p-3 backdrop-blur">
        <div className="mr-auto min-w-0 text-xs" data-testid="validation">
          {report.errors.length > 0 ? (
            <div className="space-y-0.5 text-danger">
              {report.errors.slice(0, 4).map((e) => (
                <p key={e} className="flex items-start gap-1.5">
                  <AlertIcon size={13} className="mt-0.5 shrink-0" />
                  {e}
                </p>
              ))}
              {report.errors.length > 4 ? <p>… and {report.errors.length - 4} more</p> : null}
            </div>
          ) : (
            <p className="text-s">Valid: {draft.attributes.length} attributes, {draft.examples.length} examples.</p>
          )}
          {report.warnings.map((w) => (
            <p key={w} className="mt-0.5 flex items-start gap-1.5 text-amber">
              <InfoIcon size={13} className="mt-0.5 shrink-0" />
              {w}
            </p>
          ))}
        </div>
        {original ? (
          <Button size="sm" variant="ghost" onClick={() => setDataset(original)}>
            Restore course version
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" disabled={!dirty} onClick={() => setDraft(dataset)}>
          Discard changes
        </Button>
        <Button
          variant="primary"
          disabled={report.errors.length > 0}
          onClick={() => {
            setDataset({ ...draft, sampleHypotheses: draft.attributes === dataset.attributes ? draft.sampleHypotheses : undefined });
            setView('simulator');
          }}
          data-testid="apply-dataset"
        >
          Run Candidate Elimination
        </Button>
      </div>
      {loaded ? (
        <ImportWizard
          table={loaded}
          onClose={() => setLoaded(null)}
          onCreate={(ds) => {
            setLoaded(null);
            addDataset(ds);
            setView('simulator');
          }}
        />
      ) : null}
    </div>
  );
}

function move<T>(arr: T[], from: number, to: number): T[] {
  const a = [...arr];
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x);
  return a;
}

function CellInput({ attr, value, onChange, label }: { attr: AttributeSpec; value: Cell; onChange: (v: Cell) => void; label: string }) {
  if (attr.kind === 'categorical') {
    const known = value === null || attr.values.includes(String(value));
    return (
      <select className={cn(input, 'max-w-[150px] font-mono', !known && 'border-danger text-danger')} value={value === null ? '__missing' : String(value)} aria-label={label} onChange={(e) => onChange(e.target.value === '__missing' ? null : e.target.value)}>
        {!known ? <option value={String(value)}>{String(value)} (not in domain)</option> : null}
        {attr.values.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
        <option value="__missing">missing</option>
      </select>
    );
  }
  return (
    <input
      className={cn(input, 'w-20 font-mono')}
      aria-label={label}
      defaultValue={value === null ? '' : String(value)}
      key={String(value)}
      placeholder="missing"
      onBlur={(e) => {
        const t = e.target.value.trim();
        onChange(t === '' ? null : Number(t));
      }}
    />
  );
}
