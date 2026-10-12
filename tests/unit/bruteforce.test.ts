/**
 * Independent verification: enumerate the whole hypothesis space H, keep the
 * hypotheses consistent with the data, compute its maximal and minimal elements
 * by brute force, and compare with the S and G computed by Candidate Elimination.
 */
import { describe, expect, it } from 'vitest';
import {
  ANY,
  bottom,
  canonicalize,
  covers,
  createSpace,
  enumerateVersionSpace,
  hKey,
  isCollapsed,
  NONE,
  runBoundaries,
  strictlyMoreGeneral,
  type AttributeSpec,
  type Cell,
  type Example,
  type Hypothesis,
  type HypothesisSpace,
} from '../../src/lib/ce';
import { SPORT, ENJOY_SPORT, SHAPES_BRANCHING, SHAPES_CONVERGE } from '../../src/lib/datasets';
import { keysOf, rng } from './helpers';

function allHypotheses(space: HypothesisSpace): Hypothesis[] {
  const options = space.lattices.map((lat) => lat.listBetween(NONE, ANY));
  const out: Hypothesis[] = [bottom(space)];
  const rec = (i: number, acc: Hypothesis) => {
    if (i === options.length) {
      out.push(canonicalize(space, acc));
      return;
    }
    for (const c of options[i]) rec(i + 1, [...acc, c]);
  };
  rec(0, []);
  return out;
}

function bruteForce(space: HypothesisSpace, examples: Example[]) {
  const consistent = allHypotheses(space).filter((h) => examples.every((e) => covers(space, h, e.values) === e.label));
  const G = consistent.filter((h) => !consistent.some((o) => strictlyMoreGeneral(space, o, h)));
  const S = consistent.filter((h) => !consistent.some((o) => strictlyMoreGeneral(space, h, o)));
  return { consistent, S, G };
}

function check(space: HypothesisSpace, examples: Example[]) {
  const ce = runBoundaries(space, examples);
  const bf = bruteForce(space, examples);
  if (bf.consistent.length === 0) {
    expect(isCollapsed(ce)).toBe(true);
    return;
  }
  expect(keysOf(ce.S)).toEqual(keysOf(bf.S));
  expect(keysOf(ce.G)).toEqual(keysOf(bf.G));
  const vs = enumerateVersionSpace(space, ce, 100000);
  expect(vs.status).toBe('complete');
  expect(keysOf(vs.hypotheses)).toEqual(keysOf(bf.consistent));
}

describe('brute-force verification on the course datasets', () => {
  it('Sport: every prefix of the training sequence', () => {
    const space = createSpace(SPORT.attributes);
    for (let n = 0; n <= SPORT.examples.length; n++) check(space, SPORT.examples.slice(0, n));
  });
  it('EnjoySport and synthetic datasets', () => {
    for (const ds of [ENJOY_SPORT, SHAPES_BRANCHING, SHAPES_CONVERGE]) {
      const space = createSpace(ds.attributes);
      for (let n = 0; n <= ds.examples.length; n++) check(space, ds.examples.slice(0, n));
    }
  });
});

function randomAttributes(r: () => number): AttributeSpec[] {
  const n = 2 + Math.floor(r() * 3);
  const attrs: AttributeSpec[] = [];
  for (let i = 0; i < n; i++) {
    const kind = r();
    if (kind < 0.2) {
      attrs.push({ kind: 'interval', name: `N${i}`, min: 0, max: 3 + Math.floor(r() * 3), step: 1 });
    } else {
      const k = 2 + Math.floor(r() * 3);
      const values = Array.from({ length: k }, (_, j) => `v${j}`);
      const withHierarchy = k >= 3 && kind < 0.45;
      attrs.push({
        kind: 'categorical',
        name: `C${i}`,
        values,
        hierarchy: withHierarchy ? [{ name: 'low', members: values.slice(0, 2) }, ...(k === 4 ? [{ name: 'high', members: values.slice(2) }] : [])] : undefined,
      });
    }
  }
  return attrs;
}

function randomValue(a: AttributeSpec, r: () => number): Cell {
  if (r() < 0.05) return null;
  if (a.kind === 'interval') return Math.floor(r() * (a.max - a.min + 1)) + a.min;
  return a.values[Math.floor(r() * a.values.length)];
}

describe('brute-force verification on 300 random datasets (categorical, hierarchies, intervals, missing values)', () => {
  it('S and G equal the minimal / maximal consistent hypotheses', () => {
    const r = rng(20261012);
    let nonEmpty = 0;
    for (let t = 0; t < 300; t++) {
      const attrs = randomAttributes(r);
      const space = createSpace(attrs);
      const m = 1 + Math.floor(r() * 6);
      const examples: Example[] = Array.from({ length: m }, (_, i) => ({
        id: `e${i}`,
        values: attrs.map((a) => randomValue(a, r)),
        label: r() < 0.5,
      }));
      check(space, examples);
      if (!isCollapsed(runBoundaries(space, examples))) nonEmpty++;
    }
    expect(nonEmpty).toBeGreaterThan(100);
  });
});

it('hKey is stable for canonical hypotheses', () => {
  const space = createSpace(SPORT.attributes);
  for (const h of allHypotheses(space).slice(0, 200)) expect(hKey(canonicalize(space, h))).toBe(hKey(h));
});
