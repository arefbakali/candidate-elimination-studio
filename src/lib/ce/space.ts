/**
 * Hypothesis language: one constraint lattice per attribute.
 *
 * For a conjunctive hypothesis language, the generality order on H is the
 * product of the per-attribute orders (slide 68: h1 ⪯ h2 ⇔ cover(h1) ⊆ cover(h2)).
 * Each attribute therefore only needs to know, for its own constraints:
 *   covers, ⊇ (geq), the least constraint that also admits a value (lub),
 *   and the maximal sub-constraints that exclude a value (excludeMax).
 *
 * Two attribute languages are supported:
 *  - categorical, optionally with a tree hierarchy of named groups;
 *  - numerical intervals [lo, hi] on a regular grid (min + k·step).
 */
import { AttributeSpec, CategoricalAttribute, Cell, CEValidationError, Constraint, IntervalAttribute } from './types';

export const ANY: Constraint = Object.freeze({ t: 'any' as const });
export const NONE: Constraint = Object.freeze({ t: 'none' as const });

export interface AttrLattice {
  readonly spec: AttributeSpec;
  canonical(c: Constraint): Constraint;
  covers(c: Constraint, v: Cell): boolean;
  /** a ⊇ b, i.e. every value admitted by b is admitted by a. */
  geq(a: Constraint, b: Constraint): boolean;
  /** Least constraint ⊇ c that admits v (minimal generalisation on one attribute). */
  lub(c: Constraint, v: Cell): Constraint;
  /** Maximal constraints c' ⊂ c that reject v (requires covers(c, v)). */
  excludeMax(c: Constraint, v: Cell): Constraint[];
  /** Number of constraints c' (≠ ∅) with lower ⊆ c' ⊆ upper. May be Infinity. */
  countBetween(lower: Constraint, upper: Constraint): number;
  /** The constraints counted by countBetween (only call when the count is finite). */
  listBetween(lower: Constraint, upper: Constraint): Constraint[];
  /** Leaf values admitted (categorical only) — used for explanations. */
  describe(c: Constraint): string;
  validateValue(v: Cell): string | null;
}

export interface HypothesisSpace {
  readonly attributes: readonly AttributeSpec[];
  readonly lattices: readonly AttrLattice[];
}

const ROOT = '#root';
const vId = (v: string) => `v:${v}`;
const gId = (g: string) => `g:${g}`;

function createCategorical(spec: CategoricalAttribute): AttrLattice {
  if (spec.values.length === 0) throw new CEValidationError(`Attribute "${spec.name}" has an empty domain.`);
  const valueSet = new Set(spec.values);
  if (valueSet.size !== spec.values.length) throw new CEValidationError(`Attribute "${spec.name}" has duplicate values.`);
  const groups = spec.hierarchy ?? [];
  const groupNames = new Set<string>();
  for (const g of groups) {
    if (!g.name.trim()) throw new CEValidationError(`Attribute "${spec.name}": a hierarchy group has no name.`);
    if (valueSet.has(g.name)) throw new CEValidationError(`Attribute "${spec.name}": group "${g.name}" has the same name as a value.`);
    if (groupNames.has(g.name)) throw new CEValidationError(`Attribute "${spec.name}": duplicate group "${g.name}".`);
    if (g.members.length === 0) throw new CEValidationError(`Attribute "${spec.name}": group "${g.name}" is empty.`);
    groupNames.add(g.name);
  }
  const parent = new Map<string, string>();
  for (const g of groups) {
    for (const m of g.members) {
      const id = valueSet.has(m) ? vId(m) : groupNames.has(m) ? gId(m) : null;
      if (!id) throw new CEValidationError(`Attribute "${spec.name}": group "${g.name}" contains unknown member "${m}".`);
      if (parent.has(id)) throw new CEValidationError(`Attribute "${spec.name}": "${m}" belongs to two groups; the hierarchy must be a tree.`);
      parent.set(id, gId(g.name));
    }
  }
  const allNodes = [...spec.values.map(vId), ...groups.map((g) => gId(g.name))];
  for (const n of allNodes) if (!parent.has(n)) parent.set(n, ROOT);
  // cycle check
  for (const n of allNodes) {
    const seen = new Set<string>();
    let cur: string | undefined = n;
    while (cur && cur !== ROOT) {
      if (seen.has(cur)) throw new CEValidationError(`Attribute "${spec.name}": the hierarchy contains a cycle.`);
      seen.add(cur);
      cur = parent.get(cur);
    }
  }
  const children = new Map<string, string[]>();
  children.set(ROOT, []);
  for (const n of allNodes) children.set(n, []);
  for (const n of allNodes) children.get(parent.get(n)!)!.push(n);
  const leaves = new Map<string, Set<string>>();
  const leafSet = (id: string): Set<string> => {
    const cached = leaves.get(id);
    if (cached) return cached;
    let s: Set<string>;
    if (id.startsWith('v:')) s = new Set([id.slice(2)]);
    else {
      s = new Set();
      for (const c of children.get(id)!) for (const l of leafSet(c)) s.add(l);
    }
    leaves.set(id, s);
    return s;
  };
  for (const n of [ROOT, ...allNodes]) {
    if (leafSet(n).size === 0) throw new CEValidationError(`Attribute "${spec.name}": a group contains no value.`);
  }
  /** Top-most node with the same extension (a group with a single child is equivalent to it). */
  const canonId = (id: string): string => {
    let cur = id;
    while (cur !== ROOT) {
      const p = parent.get(cur)!;
      if (leafSet(p).size === leafSet(cur).size) cur = p;
      else break;
    }
    return cur;
  };
  const toId = (c: Constraint): string => {
    if (c.t === 'any') return ROOT;
    if (c.t === 'val') {
      if (!valueSet.has(c.v)) throw new CEValidationError(`"${c.v}" is not a value of "${spec.name}".`);
      return vId(c.v);
    }
    if (c.t === 'grp') {
      if (!groupNames.has(c.g)) throw new CEValidationError(`"${c.g}" is not a group of "${spec.name}".`);
      return gId(c.g);
    }
    throw new CEValidationError(`Constraint "${c.t}" is not valid for categorical attribute "${spec.name}".`);
  };
  const fromId = (id: string): Constraint => {
    if (id === ROOT) return ANY;
    if (id.startsWith('v:')) return { t: 'val', v: id.slice(2) };
    return { t: 'grp', g: id.slice(2) };
  };
  const ancestorsOf = (id: string): string[] => {
    const out = [id];
    let cur = id;
    while (cur !== ROOT) {
      cur = parent.get(cur)!;
      out.push(cur);
    }
    return out;
  };
  const canonical = (c: Constraint): Constraint => (c.t === 'none' ? NONE : fromId(canonId(toId(c))));
  const subset = (a: Set<string>, b: Set<string>) => {
    for (const x of a) if (!b.has(x)) return false;
    return true;
  };
  const geq = (a: Constraint, b: Constraint) => {
    if (b.t === 'none') return true;
    if (a.t === 'none') return false;
    if (a.t === 'any') return true;
    return subset(leafSet(toId(b)), leafSet(toId(a)));
  };
  const subtree = (id: string): string[] => {
    const out: string[] = [id];
    for (const c of children.get(id) ?? []) out.push(...subtree(c));
    return out;
  };
  const uniqueCanon = (ids: string[]): Constraint[] => {
    const seen = new Set<string>();
    const out: Constraint[] = [];
    for (const id of ids) {
      const c = canonId(id);
      if (!seen.has(c)) {
        seen.add(c);
        out.push(fromId(c));
      }
    }
    return out;
  };
  const listBetween = (lower: Constraint, upper: Constraint): Constraint[] => {
    if (upper.t === 'none') return [];
    const pool = lower.t === 'none' ? subtree(toId(upper)) : ancestorsOf(toId(lower));
    return uniqueCanon(pool).filter((c) => geq(upper, c) && geq(c, lower));
  };
  return {
    spec,
    canonical,
    covers(c, v) {
      if (c.t === 'none') return false;
      if (c.t === 'any') return true;
      if (v === null) return false;
      return leafSet(toId(c)).has(String(v));
    },
    geq,
    lub(c, v) {
      if (v === null) return ANY;
      const leaf = vId(String(v));
      if (c.t === 'none') return fromId(canonId(leaf));
      const anc = new Set(ancestorsOf(toId(c)));
      let cur = leaf;
      while (!anc.has(cur)) cur = parent.get(cur)!;
      return fromId(canonId(cur));
    },
    excludeMax(c, v) {
      if (c.t === 'none') return [];
      const top = toId(c);
      if (v === null) {
        // only "?" admits a missing value; its maximal proper sub-constraints are the root's children
        return top === ROOT ? uniqueCanon(children.get(ROOT)!) : [];
      }
      const path: string[] = [];
      let cur: string | undefined = vId(String(v));
      while (cur !== undefined) {
        path.push(cur);
        if (cur === top) break;
        cur = cur === ROOT ? undefined : parent.get(cur);
      }
      if (path[path.length - 1] !== top) return [];
      const out: string[] = [];
      for (let i = path.length - 1; i > 0; i--) {
        const p = path[i];
        const next = path[i - 1];
        for (const ch of children.get(p)!) if (ch !== next) out.push(ch);
      }
      return uniqueCanon(out);
    },
    countBetween(lower, upper) {
      return listBetween(lower, upper).length;
    },
    listBetween,
    describe(c) {
      if (c.t === 'none') return 'no value';
      if (c.t === 'any') return 'any value';
      if (c.t === 'val') return c.v;
      if (c.t === 'grp') return `${c.g} = {${[...leafSet(toId(c))].join(', ')}}`;
      return formatInvalid(c);
    },
    validateValue(v) {
      if (v === null) return null;
      if (typeof v !== 'string' || !valueSet.has(v)) return `"${v}" is not in the domain of "${spec.name}" {${spec.values.join(', ')}}`;
      return null;
    },
  };
}

function formatInvalid(c: Constraint): string {
  throw new CEValidationError(`Constraint "${c.t}" is not valid for a categorical attribute.`);
}

function decimals(x: number): number {
  if (!Number.isFinite(x)) return 0;
  const s = String(x);
  if (s.includes('e-')) return Number(s.split('e-')[1]);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}

function createInterval(spec: IntervalAttribute): AttrLattice {
  const { min, max, step } = spec;
  if (!(step > 0) || !Number.isFinite(step)) throw new CEValidationError(`Attribute "${spec.name}": step must be a positive number.`);
  if (!(min < max)) throw new CEValidationError(`Attribute "${spec.name}": min must be smaller than max.`);
  const dec = Math.max(decimals(step), decimals(min));
  const snap = (x: number) => (Number.isFinite(x) ? Number(x.toFixed(dec)) : x);
  const origin = Number.isFinite(min) ? min : 0;
  const onGrid = (x: number) => {
    const k = (x - origin) / step;
    return Math.abs(k - Math.round(k)) < 1e-9;
  };
  const range = (c: Constraint): [number, number] => {
    if (c.t === 'any') return [min, max];
    if (c.t === 'int') return [c.lo, c.hi];
    throw new CEValidationError(`Constraint "${c.t}" is not valid for interval attribute "${spec.name}".`);
  };
  const make = (lo: number, hi: number): Constraint => {
    const l = Math.max(lo, min);
    const h = Math.min(hi, max);
    if (l > h) return NONE;
    if (l <= min && h >= max) return ANY;
    return { t: 'int', lo: snap(l), hi: snap(h) };
  };
  const canonical = (c: Constraint): Constraint => {
    if (c.t === 'none') return NONE;
    const [lo, hi] = range(c);
    return make(lo, hi);
  };
  const geq = (a: Constraint, b: Constraint) => {
    if (b.t === 'none') return true;
    if (a.t === 'none') return false;
    const [al, ah] = range(a);
    const [bl, bh] = range(b);
    return al <= bl && bh <= ah;
  };
  /** Number of grid points in [a, b]. */
  const points = (a: number, b: number) => {
    if (a > b) return 0;
    if (!Number.isFinite(a) || !Number.isFinite(b)) return Infinity;
    return Math.floor((b - a) / step + 1e-9) + 1;
  };
  const countBetween = (lower: Constraint, upper: Constraint): number => {
    if (upper.t === 'none') return 0;
    const [ul, uh] = range(upper);
    if (lower.t === 'none') {
      const n = points(ul, uh);
      return n === Infinity ? Infinity : (n * (n + 1)) / 2;
    }
    const [ll, lh] = range(lower);
    if (ll < ul || lh > uh) return 0;
    return points(ul, ll) * points(lh, uh);
  };
  return {
    spec,
    canonical,
    covers(c, v) {
      if (c.t === 'none') return false;
      if (c.t === 'any') return true;
      if (typeof v !== 'number') return false;
      const [lo, hi] = range(c);
      return lo <= v && v <= hi;
    },
    geq,
    lub(c, v) {
      if (v === null || typeof v !== 'number') return ANY;
      if (c.t === 'none') return make(v, v);
      const [lo, hi] = range(c);
      return make(Math.min(lo, v), Math.max(hi, v));
    },
    excludeMax(c, v) {
      if (c.t === 'none') return [];
      const [lo, hi] = range(c);
      const out: Constraint[] = [];
      if (v === null || typeof v !== 'number') {
        if (c.t !== 'any') return [];
        // maximal proper sub-intervals of the whole domain (none exists on an unbounded side)
        if (Number.isFinite(min)) out.push(make(snap(min + step), max));
        if (Number.isFinite(max)) out.push(make(min, snap(max - step)));
        return out.filter((x) => x.t !== 'none');
      }
      const left = snap(v - step);
      const right = snap(v + step);
      if (left >= lo) out.push(make(lo, left));
      if (right <= hi) out.push(make(right, hi));
      return out.filter((x) => x.t !== 'none');
    },
    countBetween,
    listBetween(lower, upper) {
      const n = countBetween(lower, upper);
      if (!Number.isFinite(n)) throw new CEValidationError('Infinite set of intervals.');
      const [ul, uh] = range(upper);
      const out: Constraint[] = [];
      if (lower.t === 'none') {
        const pts: number[] = [];
        for (let i = 0; i < points(ul, uh); i++) pts.push(snap(ul + i * step));
        for (let i = 0; i < pts.length; i++) for (let j = i; j < pts.length; j++) out.push(make(pts[i], pts[j]));
        return out;
      }
      const [ll, lh] = range(lower);
      for (let i = 0; i < points(ul, ll); i++)
        for (let j = 0; j < points(lh, uh); j++) out.push(make(snap(ul + i * step), snap(lh + j * step)));
      return out;
    },
    describe(c) {
      if (c.t === 'none') return 'no value';
      if (c.t === 'any') return 'any value';
      const [lo, hi] = range(c);
      return `${lo} ≤ ${spec.name} ≤ ${hi}`;
    },
    validateValue(v) {
      if (v === null) return null;
      if (typeof v !== 'number' || Number.isNaN(v)) return `"${v}" is not a number (attribute "${spec.name}")`;
      if (v < min || v > max) return `${v} is outside the domain of "${spec.name}"`;
      if (!onGrid(v)) return `${v} is not on the grid of "${spec.name}" (step ${step})`;
      return null;
    },
  };
}

export function createSpace(attributes: readonly AttributeSpec[]): HypothesisSpace {
  if (attributes.length === 0) throw new CEValidationError('At least one attribute is required.');
  const names = new Set<string>();
  for (const a of attributes) {
    if (names.has(a.name)) throw new CEValidationError(`Duplicate attribute name "${a.name}".`);
    names.add(a.name);
  }
  return {
    attributes,
    lattices: attributes.map((a) => (a.kind === 'categorical' ? createCategorical(a) : createInterval(a))),
  };
}
