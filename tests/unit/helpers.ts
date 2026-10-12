import { createSpace, formatHypothesis, hKey, parseHypothesis, type Dataset, type Hypothesis, type HypothesisSpace } from '../../src/lib/ce';

export function spaceOf(ds: Dataset): HypothesisSpace {
  return createSpace(ds.attributes);
}

/** Parse course-notation hypotheses into a sorted list of canonical keys. */
export function keys(space: HypothesisSpace, hs: (string | string[])[]): string[] {
  return hs.map((h) => hKey(parseHypothesis(space, h))).sort();
}

export function keysOf(hs: readonly Hypothesis[]): string[] {
  return hs.map(hKey).sort();
}

export function show(hs: readonly Hypothesis[]): string[] {
  return hs.map(formatHypothesis).sort();
}

/** Deterministic pseudo-random generator (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
