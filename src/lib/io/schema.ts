/**
 * Zod schemas for the JSON dataset format (import/export) and dataset validation.
 * JSON has no Infinity, so unbounded interval ends are written "inf" / "-inf".
 */
import { z } from 'zod';
import { createSpace } from '../ce/space';
import { CEValidationError, type AttributeSpec, type Dataset } from '../ce/types';

const bound = z.union([z.number(), z.literal('inf'), z.literal('+inf'), z.literal('-inf'), z.null()]).transform((v) => {
  if (v === 'inf' || v === '+inf') return Infinity;
  if (v === '-inf') return -Infinity;
  return v;
});

const hierarchyGroup = z.object({ name: z.string().min(1), members: z.array(z.string()).min(1) });

export const attributeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('categorical'),
    name: z.string().min(1),
    values: z.array(z.string().min(1)).min(1),
    hierarchy: z.array(hierarchyGroup).optional(),
  }),
  z.object({
    kind: z.literal('interval'),
    name: z.string().min(1),
    min: bound,
    max: bound,
    step: z.number().positive(),
    unit: z.string().optional(),
  }),
]);

const cell = z.union([z.string(), z.number(), z.null()]);

const constraintSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('any') }),
  z.object({ t: z.literal('none') }),
  z.object({ t: z.literal('val'), v: z.string() }),
  z.object({ t: z.literal('grp'), g: z.string() }),
  z.object({ t: z.literal('int'), lo: bound, hi: bound }),
]);

export const datasetSchema = z.object({
  id: z.string().default('imported'),
  name: z.string().default('Imported dataset'),
  description: z.string().optional(),
  source: z.string().optional(),
  attributes: z.array(attributeSchema).min(1),
  examples: z.array(
    z.object({
      id: z.string().optional(),
      values: z.array(cell),
      label: z.union([z.boolean(), z.literal(1), z.literal(0)]).transform((v) => v === true || v === 1),
    }),
  ),
  sampleHypotheses: z.array(z.object({ label: z.string(), h: z.array(constraintSchema) })).optional(),
  testInstances: z.array(z.object({ label: z.string(), values: z.array(cell) })).optional(),
});

export function parseDatasetObject(obj: unknown): Dataset {
  const r = datasetSchema.safeParse(obj);
  if (!r.success) {
    const msg = r.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.') || 'dataset'}: ${i.message}`)
      .join('; ');
    throw new CEValidationError(`Invalid dataset JSON — ${msg}`);
  }
  const d = r.data;
  return {
    ...d,
    attributes: d.attributes.map((a) =>
      a.kind === 'interval' ? { ...a, min: a.min ?? -Infinity, max: a.max ?? Infinity } : a,
    ) as AttributeSpec[],
    examples: d.examples.map((e, i) => ({ id: e.id ?? `x${i + 1}`, values: e.values, label: e.label })),
    sampleHypotheses: d.sampleHypotheses?.map((s) => ({
      label: s.label,
      h: s.h.map((c) => (c.t === 'int' ? { t: 'int' as const, lo: c.lo ?? -Infinity, hi: c.hi ?? Infinity } : c)),
    })),
  };
}

/** JSON-safe representation (Infinity → "inf"). */
export function serializeDataset(ds: Dataset): unknown {
  return JSON.parse(
    JSON.stringify(ds, (_k, v) => {
      if (v === Infinity) return 'inf';
      if (v === -Infinity) return '-inf';
      return v;
    }),
  );
}

export interface ValidationReport {
  errors: string[];
  warnings: string[];
}

export const LIMITS = { attributes: 24, examples: 2000, values: 80 };

export function validateDataset(ds: Dataset): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (ds.attributes.length > LIMITS.attributes) errors.push(`At most ${LIMITS.attributes} attributes are supported (got ${ds.attributes.length}).`);
  if (ds.examples.length > LIMITS.examples) errors.push(`At most ${LIMITS.examples} examples are supported (got ${ds.examples.length}).`);
  for (const a of ds.attributes) {
    if (a.kind === 'categorical' && a.values.length > LIMITS.values) errors.push(`"${a.name}" has ${a.values.length} values; at most ${LIMITS.values} are supported. Group or discretise them.`);
  }
  let space;
  try {
    space = createSpace(ds.attributes);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
    return { errors, warnings };
  }
  let missing = 0;
  const seen = new Map<string, boolean>();
  ds.examples.forEach((ex, i) => {
    const name = ex.id || `#${i + 1}`;
    if (ex.values.length !== ds.attributes.length) {
      errors.push(`Example ${name} has ${ex.values.length} values for ${ds.attributes.length} attributes.`);
      return;
    }
    ex.values.forEach((v, j) => {
      if (v === null) missing++;
      const err = space.lattices[j].validateValue(v);
      if (err) errors.push(`Example ${name}: ${err}.`);
    });
    const key = JSON.stringify(ex.values);
    const prev = seen.get(key);
    if (prev !== undefined && prev !== ex.label) warnings.push(`Example ${name} repeats an earlier instance with the opposite label: the version space will become empty.`);
    seen.set(key, ex.label);
  });
  if (missing > 0) warnings.push(`${missing} missing value${missing === 1 ? '' : 's'}: only "?" covers a missing value (see the documentation).`);
  if (ds.examples.length === 0) warnings.push('The dataset has no training example yet.');
  return { errors: errors.slice(0, 50), warnings };
}
