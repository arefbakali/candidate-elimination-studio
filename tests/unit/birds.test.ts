import { describe, expect, it } from 'vitest';
import { buildLattice, canonicalize, candidateElimination, enumerateVersionSpace, formatHypothesis, inVersionSpace, parseHypothesis } from '../../src/lib/ce';
import { BIRDS } from '../../src/lib/datasets';
import { keys, keysOf, show, spaceOf } from './helpers';

const space = spaceOf(BIRDS);
const run = candidateElimination(space, BIRDS.examples);
const H = run.history;

describe('Birds dataset — interval and hierarchy language, slides 79–82', () => {
  it('S1 = {(True, [30, 30], russet)}', () => {
    expect(keysOf(H[1].S)).toEqual(keys(space, ['(True, [30, 30], russet)']));
    expect(keysOf(H[1].G)).toEqual(keys(space, ['(?, ?, ?)']));
  });

  it('negative (False, 70, grey) generates the four specialisations of slide 80, of which three are kept', () => {
    const dG = run.details[1].updates[1];
    expect(show(dG.candidates.map((c) => c.h))).toEqual(
      show([
        parseHypothesis(space, '(True, ?, ?)'),
        parseHypothesis(space, '(?, [0, 69], ?)'),
        parseHypothesis(space, '(?, [71, +∞[, ?)'),
        parseHypothesis(space, '(?, ?, warm colour)'),
      ]),
    );
    const rejected = dG.candidates.filter((c) => !c.kept).map((c) => formatHypothesis(c.h));
    expect(rejected).toEqual(['⟨?, [71, +∞[, ?⟩']);
    expect(keysOf(H[2].G)).toEqual(keys(space, ['(True, ?, ?)', '(?, [0, 69], ?)', '(?, ?, warm colour)']));
    expect(keysOf(H[2].S)).toEqual(keys(space, ['(True, [30, 30], russet)']));
  });

  it('positive (True, 40, orange): [30,30] → [30,40] and russet → warm colour', () => {
    expect(keysOf(H[3].S)).toEqual(keys(space, ['(True, [30, 40], warm colour)']));
    expect(keysOf(H[3].G)).toEqual(keys(space, ['(True, ?, ?)', '(?, [0, 69], ?)', '(?, ?, warm colour)']));
  });

  it('negative (False, 60, orange): candidates and pruning exactly as on slide 81', () => {
    const dG = run.details[3].updates[1];
    const fromInterval = dG.candidates.filter((c) => formatHypothesis(c.from) === '⟨?, [0, 69], ?⟩');
    expect(fromInterval.map((c) => `${formatHypothesis(c.h)}:${c.kept ? 'kept' : 'removed'}`).sort()).toEqual(
      ['⟨True, [0, 69], ?⟩:kept', '⟨?, [0, 59], ?⟩:kept', '⟨?, [61, 69], ?⟩:removed', '⟨?, [0, 69], russet⟩:removed', '⟨?, [0, 69], cold colour⟩:removed'].sort(),
    );
    const fromWarm = dG.candidates.filter((c) => formatHypothesis(c.from) === '⟨?, ?, warm colour⟩');
    expect(fromWarm.map((c) => `${formatHypothesis(c.h)}:${c.kept ? 'kept' : 'removed'}`).sort()).toEqual(
      ['⟨True, ?, warm colour⟩:kept', '⟨?, [0, 59], warm colour⟩:kept', '⟨?, [61, +∞[, warm colour⟩:removed', '⟨?, ?, russet⟩:removed'].sort(),
    );
    expect(show(dG.pruned.map((p) => p.h))).toEqual(
      show([parseHypothesis(space, '(True, [0, 69], ?)'), parseHypothesis(space, '(True, ?, warm colour)'), parseHypothesis(space, '(?, [0, 59], warm colour)')]),
    );
    expect(keysOf(H[4].G)).toEqual(keys(space, ['(True, ?, ?)', '(?, [0, 59], ?)']));
    expect(keysOf(H[4].S)).toEqual(keys(space, ['(True, [30, 40], warm colour)']));
  });

  it('h1, h2, h3 of slide 82 belong to the final version space', () => {
    expect(BIRDS.sampleHypotheses).toHaveLength(3);
    for (const s of BIRDS.sampleHypotheses!) expect(inVersionSpace(space, run.final, canonicalize(space, s.h))).toBe(true);
    expect(inVersionSpace(space, run.final, parseHypothesis(space, '(True, [30, 55], ?)'))).toBe(true);
  });

  it('hypotheses outside the bounds are rejected', () => {
    expect(inVersionSpace(space, run.final, parseHypothesis(space, '(?, [0, 60], ?)'))).toBe(false); // covers penguin 2
    expect(inVersionSpace(space, run.final, parseHypothesis(space, '(True, [31, 40], warm colour)'))).toBe(false); // misses duck 1
  });

  it('the version space is infinite, so the lattice is drawn as boundaries + verified samples', () => {
    expect(enumerateVersionSpace(space, run.final).status).toBe('infinite');
    const lat = buildLattice(space, run.final, { samples: BIRDS.sampleHypotheses });
    expect(lat.mode).toBe('boundary');
    expect(lat.nodes.filter((n) => n.roles.includes('sample'))).toHaveLength(3);
    expect(lat.edges.every((e) => e.kind !== 'cover')).toBe(true);
  });
});
