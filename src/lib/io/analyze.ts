/**
 * Turning an arbitrary table into a Candidate Elimination dataset.
 *
 * Candidate Elimination is only defined relative to a hypothesis language,
 * so every column must be mapped explicitly to a supported representation:
 *   categorical  — conjunctive constraint "value or ?"
 *   interval     — closed interval [lo, hi] on a grid (min, max, step)
 *   discretize   — equal-width bins turned into categorical values
 */
import type { AttributeSpec, Cell, Dataset, Example } from '../ce/types';

export const MISSING_TOKENS = new Set(['', '?', 'na', 'n/a', 'nan', 'null', 'none', 'missing']);

export const isMissing = (s: string) => MISSING_TOKENS.has(s.trim().toLowerCase());

export interface ColumnProfile {
  index: number;
  name: string;
  distinct: string[];
  numeric: boolean;
  integer: boolean;
  min: number;
  max: number;
  decimals: number;
  missing: number;
  suggestedRole: ColumnRole;
}

export type ColumnRole = 'attribute' | 'target' | 'ignore';
export type ColumnType = 'categorical' | 'interval' | 'discretize';

export interface ColumnConfig {
  role: ColumnRole;
  type: ColumnType;
  min?: number;
  max?: number;
  step?: number;
  bins?: number;
}

export interface ImportConfig {
  name: string;
  columns: ColumnConfig[];
  /** target values that mean "positive" */
  positive: string[];
}

const POSITIVE_RE = /^(1|yes|y|true|\+|positive|pos|oui)$/i;

function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '' || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return null;
  return Number(t);
}

export function profileTable(header: string[], rows: string[][]): ColumnProfile[] {
  return header.map((name, index) => {
    const raw = rows.map((r) => (r[index] ?? '').trim());
    const present = raw.filter((v) => !isMissing(v));
    const nums = present.map(parseNum);
    const numeric = present.length > 0 && nums.every((n) => n !== null);
    const values = nums.filter((n): n is number => n !== null);
    const decimals = numeric ? Math.max(0, ...present.map((v) => (v.includes('.') || v.includes(',') ? v.split(/[.,]/)[1].length : 0))) : 0;
    const distinct = [...new Set(present)];
    let suggestedRole: ColumnRole = 'attribute';
    if (index === header.length - 1) suggestedRole = 'target';
    else if (/^(id|identifier|#|index|row)$/i.test(name.trim()) || (rows.length >= 15 && distinct.length === rows.length && !numeric)) suggestedRole = 'ignore';
    return {
      index,
      name: name.trim() || `Column ${index + 1}`,
      distinct,
      numeric,
      integer: numeric && values.every((v) => Number.isInteger(v)),
      min: numeric ? Math.min(...values) : 0,
      max: numeric ? Math.max(...values) : 0,
      decimals,
      missing: raw.length - present.length,
      suggestedRole,
    };
  });
}

export function defaultConfig(profiles: ColumnProfile[], name = 'Imported dataset'): ImportConfig {
  const target = profiles.find((p) => p.suggestedRole === 'target');
  const positive = target ? [target.distinct.find((v) => POSITIVE_RE.test(v)) ?? target.distinct[0]].filter(Boolean) : [];
  return {
    name,
    positive,
    columns: profiles.map((p) => ({
      role: p.suggestedRole,
      // numeric columns with few values are usually codes: keep them categorical by default
      type: p.numeric && p.distinct.length > 6 ? 'interval' : 'categorical',
      min: p.numeric ? Math.floor(p.min) : undefined,
      max: p.numeric ? Math.ceil(p.max) : undefined,
      step: p.numeric ? (p.integer ? 1 : Number((10 ** -p.decimals).toFixed(p.decimals))) : undefined,
      bins: 3,
    })),
  };
}

function fmt(x: number): string {
  return Number.isInteger(x) ? String(x) : x.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function binLabels(min: number, max: number, bins: number): string[] {
  const w = (max - min) / bins;
  return Array.from({ length: bins }, (_, i) => `[${fmt(min + i * w)}, ${fmt(min + (i + 1) * w)}${i === bins - 1 ? ']' : '['}`);
}

export function binOf(v: number, min: number, max: number, bins: number): number {
  if (max === min) return 0;
  return Math.min(bins - 1, Math.max(0, Math.floor(((v - min) / (max - min)) * bins)));
}

export interface BuildResult {
  dataset: Dataset | null;
  issues: string[];
}

export function buildDataset(header: string[], rows: string[][], profiles: ColumnProfile[], config: ImportConfig): BuildResult {
  const issues: string[] = [];
  const targets = config.columns.map((c, i) => (c.role === 'target' ? i : -1)).filter((i) => i >= 0);
  if (targets.length !== 1) return { dataset: null, issues: ['Select exactly one target (label) column.'] };
  const ti = targets[0];
  if (config.positive.length === 0) return { dataset: null, issues: ['Select which target value(s) mean "positive".'] };
  const attrIdx = config.columns.map((c, i) => (c.role === 'attribute' ? i : -1)).filter((i) => i >= 0);
  if (attrIdx.length === 0) return { dataset: null, issues: ['Select at least one attribute column.'] };

  const attributes: AttributeSpec[] = attrIdx.map((i) => {
    const p = profiles[i];
    const c = config.columns[i];
    if (c.type === 'interval') {
      if (!p.numeric) issues.push(`"${p.name}" is not numeric and cannot use interval constraints.`);
      return { kind: 'interval', name: p.name, min: c.min ?? p.min, max: c.max ?? p.max, step: c.step ?? 1 };
    }
    if (c.type === 'discretize') {
      if (!p.numeric) issues.push(`"${p.name}" is not numeric and cannot be discretised.`);
      return { kind: 'categorical', name: p.name, values: binLabels(c.min ?? p.min, c.max ?? p.max, Math.max(2, c.bins ?? 3)) };
    }
    return { kind: 'categorical', name: p.name, values: [...p.distinct].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) };
  });

  const examples: Example[] = [];
  rows.forEach((r, ri) => {
    const t = (r[ti] ?? '').trim();
    if (isMissing(t)) {
      issues.push(`Row ${ri + 2}: missing label — row skipped.`);
      return;
    }
    const values: Cell[] = attrIdx.map((i, k) => {
      const raw = (r[i] ?? '').trim();
      if (isMissing(raw)) return null;
      const c = config.columns[i];
      const a = attributes[k];
      if (c.type === 'interval') return parseNum(raw);
      if (c.type === 'discretize' && a.kind === 'categorical') {
        const n = parseNum(raw);
        if (n === null) return null;
        return a.values[binOf(n, c.min ?? profiles[i].min, c.max ?? profiles[i].max, a.values.length)];
      }
      return raw;
    });
    examples.push({ id: `row ${ri + 2}`, values, label: config.positive.includes(t) });
  });
  return {
    dataset: {
      id: `import-${Date.now().toString(36)}`,
      name: config.name || 'Imported dataset',
      source: 'Imported file',
      description: `${examples.length} examples imported from a table with ${header.length} columns.`,
      attributes,
      examples,
    },
    issues,
  };
}

/** Convert a JSON array of records into a table. */
export function recordsToTable(records: Record<string, unknown>[]): { header: string[]; rows: string[][] } {
  const header: string[] = [];
  for (const r of records) for (const k of Object.keys(r)) if (!header.includes(k)) header.push(k);
  const rows = records.map((r) => header.map((h) => (r[h] === null || r[h] === undefined ? '' : String(r[h]))));
  return { header, rows };
}
