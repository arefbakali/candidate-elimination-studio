import { describe, expect, it } from 'vitest';
import { candidateElimination, hKey, runBoundaries } from '../../src/lib/ce';
import { BIRDS, BUILTIN_DATASETS, SPORT } from '../../src/lib/datasets';
import { keysOf, spaceOf } from './helpers';

describe('deterministic step history', () => {
  it('two runs produce identical traces', () => {
    const space = spaceOf(SPORT);
    const a = candidateElimination(space, SPORT.examples);
    const b = candidateElimination(space, SPORT.examples);
    const strip = (r: typeof a) => r.steps.map((s) => ({ ...s, S: keysOf(s.S), G: keysOf(s.G) }));
    expect(JSON.stringify(strip(a))).toBe(JSON.stringify(strip(b)));
  });

  it('snapshots are immutable', () => {
    const run = candidateElimination(spaceOf(SPORT), SPORT.examples);
    for (const s of run.steps) expect(Object.isFrozen(s)).toBe(true);
    expect(Object.isFrozen(run.steps[0].S[0])).toBe(true);
  });

  it('result steps agree with the boundary history and with the trace-free run', () => {
    for (const ds of BUILTIN_DATASETS) {
      const space = spaceOf(ds);
      const run = candidateElimination(space, ds.examples);
      const results = run.steps.filter((s) => s.phase === 'result');
      expect(results).toHaveLength(ds.examples.length);
      results.forEach((s, i) => {
        expect(keysOf(s.S)).toEqual(keysOf(run.history[i + 1].S));
        expect(keysOf(s.G)).toEqual(keysOf(run.history[i + 1].G));
      });
      const fast = runBoundaries(space, ds.examples);
      expect(keysOf(fast.S)).toEqual(keysOf(run.final.S));
      expect(keysOf(fast.G)).toEqual(keysOf(run.final.G));
    }
  });

  it('every step of an example starts from the previous example’s boundaries', () => {
    const run = candidateElimination(spaceOf(BIRDS), BIRDS.examples);
    run.steps
      .filter((s) => s.phase === 'present')
      .forEach((s) => {
        const prev = run.history[s.exampleIndex];
        expect(keysOf(s.S)).toEqual(keysOf(prev.S));
        expect(keysOf(s.G)).toEqual(keysOf(prev.G));
      });
  });

  it('Sport example 3 (negative) is explained in detailed steps with pseudocode lines 9–14', () => {
    const run = candidateElimination(spaceOf(SPORT), SPORT.examples);
    const ex3 = run.steps.filter((s) => s.exampleIndex === 2);
    expect(ex3.map((s) => s.phase)).toEqual(['present', 'filter', 'select', 'generate', 'filter-candidates', 'prune', 'result']);
    expect(ex3.flatMap((s) => s.lines)).toEqual([9, 10, 11, 12, 13, 13, 14]);
    const gen = ex3.find((s) => s.phase === 'generate')!;
    expect(gen.G).toHaveLength(0);
    expect(gen.candidates!.every((c) => c.status === 'pending')).toBe(true);
    const filt = ex3.find((s) => s.phase === 'filter-candidates')!;
    expect(filt.G.map(hKey)).toHaveLength(3);
  });
});
