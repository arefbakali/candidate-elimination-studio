/**
 * Hypothesis-level operations (product of the per-attribute lattices).
 */
import { ANY, HypothesisSpace, NONE } from './space';
import { Cell, Constraint, Hypothesis } from './types';

export function top(space: HypothesisSpace): Hypothesis {
  return Object.freeze(space.attributes.map(() => ANY));
}

/** ⟨∅, …, ∅⟩. Every hypothesis containing ∅ covers nothing and is canonicalised to this one. */
export function bottom(space: HypothesisSpace): Hypothesis {
  return Object.freeze(space.attributes.map(() => NONE));
}

export function isBottom(h: Hypothesis): boolean {
  return h.some((c) => c.t === 'none');
}

export function canonicalize(space: HypothesisSpace, h: Hypothesis): Hypothesis {
  if (h.length !== space.attributes.length) throw new Error('Hypothesis arity does not match the attributes.');
  if (isBottom(h)) return bottom(space);
  return Object.freeze(h.map((c, i) => space.lattices[i].canonical(c)));
}

function constraintKey(c: Constraint): string {
  switch (c.t) {
    case 'any':
      return '?';
    case 'none':
      return '∅';
    case 'val':
      return `=${c.v}`;
    case 'grp':
      return `{${c.g}}`;
    case 'int':
      return `[${c.lo},${c.hi}]`;
  }
}

/** Canonical identity of a hypothesis (two canonical hypotheses are equal iff keys are equal). */
export function hKey(h: Hypothesis): string {
  return isBottom(h) ? '⊥' : h.map(constraintKey).join('|');
}

export function covers(space: HypothesisSpace, h: Hypothesis, x: readonly Cell[]): boolean {
  return h.every((c, i) => space.lattices[i].covers(c, x[i]));
}

/** h1 ⪰ h2 : cover(h2) ⊆ cover(h1). */
export function moreGeneralOrEqual(space: HypothesisSpace, h1: Hypothesis, h2: Hypothesis): boolean {
  if (isBottom(h2)) return true;
  if (isBottom(h1)) return false;
  return h1.every((c, i) => space.lattices[i].geq(c, h2[i]));
}

/** h1 ≻ h2 (strictly more general). */
export function strictlyMoreGeneral(space: HypothesisSpace, h1: Hypothesis, h2: Hypothesis): boolean {
  return moreGeneralOrEqual(space, h1, h2) && !moreGeneralOrEqual(space, h2, h1);
}

export function dedupe(hs: readonly Hypothesis[]): Hypothesis[] {
  const seen = new Set<string>();
  const out: Hypothesis[] = [];
  for (const h of hs) {
    const k = hKey(h);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(h);
    }
  }
  return out;
}

/**
 * Minimal generalisations of s that cover the positive instance x.
 * In a conjunctive language whose attribute orders are trees or intervals,
 * the least upper bound of s and x is unique, so the result has 0 or 1 element
 * (0 when s already covers x is never requested by the algorithm).
 */
export function minimalGeneralizations(space: HypothesisSpace, s: Hypothesis, x: readonly Cell[]): Hypothesis[] {
  if (covers(space, s, x)) return [s];
  const h = space.lattices.map((lat, i) => lat.lub(isBottom(s) ? NONE : s[i], x[i]));
  return [canonicalize(space, h)];
}

export interface Specialization {
  h: Hypothesis;
  /** Attribute that was restricted, or -1 when the only specialisation is ⊥. */
  attr: number;
}

/**
 * Minimal specialisations of g that reject the negative instance x:
 * the maximal hypotheses h ≺ g with x ∉ cover(h). Each one restricts exactly
 * one attribute to a maximal sub-constraint that excludes x's value.
 */
export function minimalSpecializations(space: HypothesisSpace, g: Hypothesis, x: readonly Cell[]): Specialization[] {
  if (!covers(space, g, x)) return [];
  const out: Specialization[] = [];
  const seen = new Set<string>();
  space.lattices.forEach((lat, i) => {
    for (const c of lat.excludeMax(g[i], x[i])) {
      const h = canonicalize(
        space,
        g.map((gc, j) => (j === i ? c : gc)),
      );
      const k = hKey(h);
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ h, attr: i });
      }
    }
  });
  if (out.length === 0) out.push({ h: bottom(space), attr: -1 });
  return out;
}

/** Remove every hypothesis strictly more general than another one of the set (S-side pruning). */
export function keepMostSpecific(space: HypothesisSpace, hs: readonly Hypothesis[]) {
  const unique = dedupe(hs);
  const kept: Hypothesis[] = [];
  const pruned: { h: Hypothesis; dominatedBy: Hypothesis }[] = [];
  for (const h of unique) {
    const d = unique.find((o) => o !== h && strictlyMoreGeneral(space, h, o));
    if (d) pruned.push({ h, dominatedBy: d });
    else kept.push(h);
  }
  return { kept, pruned };
}

/** Remove every hypothesis strictly more specific than another one of the set (G-side pruning). */
export function keepMostGeneral(space: HypothesisSpace, hs: readonly Hypothesis[]) {
  const unique = dedupe(hs);
  const kept: Hypothesis[] = [];
  const pruned: { h: Hypothesis; dominatedBy: Hypothesis }[] = [];
  for (const h of unique) {
    const d = unique.find((o) => o !== h && strictlyMoreGeneral(space, o, h));
    if (d) pruned.push({ h, dominatedBy: d });
    else kept.push(h);
  }
  return { kept, pruned };
}

/** Number of attributes constrained (0 = ⊤). Used as a generality rank for layouts. */
export function specificity(h: Hypothesis): number {
  if (isBottom(h)) return h.length + 1;
  return h.filter((c) => c.t !== 'any').length;
}
