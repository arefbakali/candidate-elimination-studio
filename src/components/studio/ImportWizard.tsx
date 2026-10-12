'use client';

import * as React from 'react';
import type { Dataset } from '@/lib/ce';
import { buildDataset, defaultConfig, profileTable, type ColumnConfig, type ImportConfig } from '@/lib/io/analyze';
import { validateDataset } from '@/lib/io/schema';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { AlertIcon, CloseIcon, InfoIcon } from '@/components/ui/icons';

const input = 'h-7 rounded-md border border-line bg-panel-2 px-1.5 text-[11px] text-fg focus:border-indigo focus:outline-none';

export function ImportWizard({ table, onClose, onCreate }: { table: { header: string[]; rows: string[][]; fileName: string }; onClose: () => void; onCreate: (ds: Dataset) => void }) {
  const profiles = React.useMemo(() => profileTable(table.header, table.rows), [table]);
  const [config, setConfig] = React.useState<ImportConfig>(() => defaultConfig(profiles, table.fileName.replace(/\.[^.]+$/, '')));
  const built = React.useMemo(() => buildDataset(table.header, table.rows, profiles, config), [table, profiles, config]);
  const report = React.useMemo(() => (built.dataset ? validateDataset(built.dataset) : null), [built]);
  const targetIdx = config.columns.findIndex((c) => c.role === 'target');
  const target = targetIdx >= 0 ? profiles[targetIdx] : null;

  const setCol = (i: number, patch: Partial<ColumnConfig>) =>
    setConfig((c) => {
      const columns = c.columns.map((x, j) => {
        if (j === i) return { ...x, ...patch };
        // only one target column
        if (patch.role === 'target' && x.role === 'target') return { ...x, role: 'attribute' as const };
        return x;
      });
      let positive = c.positive;
      if (patch.role === 'target') positive = [profiles[i].distinct[0]].filter(Boolean);
      return { ...c, columns, positive };
    });

  const blocking = [...built.issues.filter((i) => !i.startsWith('Row ')), ...(report?.errors ?? [])];
  const canCreate = built.dataset !== null && blocking.length === 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Import a table">
      <div className="fade-in flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold">Import {table.fileName}</h2>
            <p className="text-xs text-muted">
              {table.rows.length} rows · {table.header.length} columns. Choose the class column and how every attribute is represented.
            </p>
          </div>
          <Button size="iconSm" variant="ghost" onClick={onClose} aria-label="Close import">
            <CloseIcon size={14} />
          </Button>
        </header>
        <div className="thin-scroll min-h-0 flex-1 space-y-4 overflow-auto p-5">
          <p className="flex items-start gap-2 rounded-lg border border-line bg-panel-2/60 p-3 text-xs text-muted">
            <InfoIcon size={14} className="mt-0.5 shrink-0 text-cyan" />
            <span>
              Candidate Elimination is exact only for the hypothesis language it searches. Categorical columns use the constraints <span className="font-mono">value</span> or <span className="font-mono">?</span>. Numeric columns can use closed intervals <span className="font-mono">[lo, hi]</span> on a grid (as for the course&apos;s bird size), be discretised into equal-width bins, or be treated as plain labels. Empty cells, <span className="font-mono">?</span> and NA become missing values, which only <span className="font-mono">?</span> accepts.
            </span>
          </p>
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr>
                  {profiles.map((p, i) => {
                    const c = config.columns[i];
                    return (
                      <th key={i} className="min-w-[150px] border-b border-line px-2 pb-2 text-left align-top font-normal">
                        <div className="mb-1 font-semibold text-fg">{p.name}</div>
                        <div className="mb-1.5 flex flex-wrap gap-1">
                          <Badge>{p.numeric ? (p.integer ? 'integer' : 'numeric') : 'text'}</Badge>
                          <Badge>{p.distinct.length} values</Badge>
                          {p.missing ? <Badge tone="amber">{p.missing} missing</Badge> : null}
                        </div>
                        <select className={cn(input, 'mb-1 w-full')} value={c.role} aria-label={`Role of ${p.name}`} onChange={(e) => setCol(i, { role: e.target.value as ColumnConfig['role'] })}>
                          <option value="attribute">attribute</option>
                          <option value="target">class (target)</option>
                          <option value="ignore">ignore</option>
                        </select>
                        {c.role === 'attribute' && p.numeric ? (
                          <>
                            <select className={cn(input, 'mb-1 w-full')} value={c.type} aria-label={`Representation of ${p.name}`} onChange={(e) => setCol(i, { type: e.target.value as ColumnConfig['type'] })}>
                              <option value="interval">interval [lo, hi]</option>
                              <option value="discretize">discretise into bins</option>
                              <option value="categorical">categorical labels</option>
                            </select>
                            {c.type === 'interval' ? (
                              <div className="grid grid-cols-3 gap-1">
                                <NumField label="min" value={c.min} onChange={(v) => setCol(i, { min: v })} />
                                <NumField label="max" value={c.max} onChange={(v) => setCol(i, { max: v })} />
                                <NumField label="step" value={c.step} onChange={(v) => setCol(i, { step: v })} />
                              </div>
                            ) : c.type === 'discretize' ? (
                              <div className="grid grid-cols-3 gap-1">
                                <NumField label="min" value={c.min} onChange={(v) => setCol(i, { min: v })} />
                                <NumField label="max" value={c.max} onChange={(v) => setCol(i, { max: v })} />
                                <NumField label="bins" value={c.bins} onChange={(v) => setCol(i, { bins: Math.max(2, Math.round(v)) })} />
                              </div>
                            ) : null}
                          </>
                        ) : null}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {table.rows.slice(0, 8).map((r, ri) => (
                  <tr key={ri} className="border-b border-line/60">
                    {profiles.map((_, i) => (
                      <td key={i} className={cn('px-2 py-1 font-mono', config.columns[i].role === 'ignore' && 'text-faint line-through', config.columns[i].role === 'target' && 'text-cyan')}>
                        {r[i]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {table.rows.length > 8 ? <p className="mt-1 text-[11px] text-faint">… {table.rows.length - 8} more rows</p> : null}
          </div>
          {target ? (
            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-fg">Which values of “{target.name}” are positive examples?</legend>
              <div className="flex flex-wrap gap-2">
                {target.distinct.map((v) => {
                  const on = config.positive.includes(v);
                  return (
                    <label key={v} className={cn('flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs', on ? 'border-s/50 bg-s/10 text-s' : 'border-line text-muted')}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setConfig((c) => ({ ...c, positive: on ? c.positive.filter((x) => x !== v) : [...c.positive, v] }))}
                        className="accent-[var(--s)]"
                      />
                      {v}
                    </label>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] text-faint">Every other value is a negative example.</p>
            </fieldset>
          ) : null}
          <label className="block text-xs text-muted">
            Dataset name
            <input className={cn(input, 'ml-2 h-8 w-64 text-xs')} value={config.name} onChange={(e) => setConfig((c) => ({ ...c, name: e.target.value }))} />
          </label>
        </div>
        <footer className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3">
          <div className="mr-auto min-w-0 text-xs">
            {blocking.slice(0, 3).map((e) => (
              <p key={e} className="flex items-start gap-1.5 text-danger">
                <AlertIcon size={13} className="mt-0.5 shrink-0" />
                {e}
              </p>
            ))}
            {built.issues.filter((i) => i.startsWith('Row ')).length ? <p className="text-amber">{built.issues.filter((i) => i.startsWith('Row ')).length} rows without a class are skipped.</p> : null}
            {report?.warnings.map((w) => (
              <p key={w} className="text-amber">
                {w}
              </p>
            ))}
            {canCreate ? (
              <p className="text-s">
                Ready: {built.dataset!.attributes.length} attributes, {built.dataset!.examples.filter((e) => e.label).length} positive and {built.dataset!.examples.filter((e) => !e.label).length} negative examples.
              </p>
            ) : null}
          </div>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canCreate} onClick={() => built.dataset && onCreate(built.dataset)} data-testid="import-create">
            Create dataset
          </Button>
        </footer>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value?: number; onChange: (v: number) => void }) {
  return (
    <label className="text-[10px] text-faint">
      {label}
      <input
        className={cn(input, 'w-full font-mono')}
        defaultValue={value === undefined ? '' : value === Infinity ? '+inf' : value === -Infinity ? '-inf' : String(value)}
        onBlur={(e) => {
          const t = e.target.value.trim().toLowerCase();
          const v = t === 'inf' || t === '+inf' ? Infinity : t === '-inf' ? -Infinity : Number(t);
          if (!Number.isNaN(v)) onChange(v);
        }}
      />
    </label>
  );
}
