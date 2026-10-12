import { describe, expect, it } from 'vitest';
import { candidateElimination, classifyWithVersionSpace, enumerateVersionSpace, runBoundaries } from '../../src/lib/ce';
import { CONTRADICTION, ENJOY_SPORT, ENJOY_SPORT_NOISY, SHAPES_BRANCHING, SHAPES_CONVERGE } from '../../src/lib/datasets';
import { keys, keysOf, spaceOf } from './helpers';

describe('EnjoySport — version space of slide 85 and classification of slides 86–87', () => {
  const space = spaceOf(ENJOY_SPORT);
  const final = runBoundaries(space, ENJOY_SPORT.examples);
  const vs = enumerateVersionSpace(space, final);

  it('S and G match slide 85', () => {
    expect(keysOf(final.S)).toEqual(keys(space, ['⟨Sunny, Warm, ?, Strong, ?, ?⟩']));
    expect(keysOf(final.G)).toEqual(keys(space, ['⟨Sunny, ?, ?, ?, ?, ?⟩', '⟨?, Warm, ?, ?, ?, ?⟩']));
  });

  it('the version space has the 6 hypotheses of slide 85', () => {
    expect(keysOf(vs.hypotheses)).toEqual(
      keys(space, [
        '⟨Sunny, ?, ?, ?, ?, ?⟩',
        '⟨?, Warm, ?, ?, ?, ?⟩',
        '⟨Sunny, ?, ?, Strong, ?, ?⟩',
        '⟨Sunny, Warm, ?, ?, ?, ?⟩',
        '⟨?, Warm, ?, Strong, ?, ?⟩',
        '⟨Sunny, Warm, ?, Strong, ?, ?⟩',
      ]),
    );
  });

  const [A, B, C, D] = ENJOY_SPORT.testInstances!.map((t) => t.values);
  it('slide 86: (Sunny, Warm, Normal, Strong, Cool, Change) is positive for all 6 hypotheses', () => {
    const r = classifyWithVersionSpace(space, final, A, vs);
    expect(r.verdict).toBe('positive');
    expect(r.exactVotes).toEqual({ positive: 6, negative: 0, total: 6 });
  });
  it('slide 87: (Rainy, Cold, Normal, Weak, Warm, Same) is negative (no g covers it)', () => {
    const r = classifyWithVersionSpace(space, final, B, vs);
    expect(r.verdict).toBe('negative');
    expect(r.exactVotes).toEqual({ positive: 0, negative: 6, total: 6 });
  });
  it('slide 87: (Sunny, Warm, Normal, Weak, Warm, Same) splits 3 / 3', () => {
    const r = classifyWithVersionSpace(space, final, C, vs);
    expect(r.verdict).toBe('undetermined');
    expect(r.exactVotes).toEqual({ positive: 3, negative: 3, total: 6 });
  });
  it('slide 87: (Sunny, Cold, Normal, Strong, Warm, Same) splits 2 positive / 4 negative', () => {
    const r = classifyWithVersionSpace(space, final, D, vs);
    expect(r.verdict).toBe('undetermined');
    expect(r.exactVotes).toEqual({ positive: 2, negative: 4, total: 6 });
  });
});

describe('Limits of Candidate Elimination (slides 83–84)', () => {
  it('noisy EnjoySport: G2 = G3 = {⟨?, ?, Normal, ?, ?, ?⟩}, then G becomes empty on example 4', () => {
    const space = spaceOf(ENJOY_SPORT_NOISY);
    const run = candidateElimination(space, ENJOY_SPORT_NOISY.examples);
    expect(keysOf(run.history[1].S)).toEqual(keys(space, ['⟨Sunny, Warm, Normal, Strong, Warm, Same⟩']));
    expect(keysOf(run.history[2].G)).toEqual(keys(space, ['⟨?, ?, Normal, ?, ?, ?⟩']));
    expect(keysOf(run.history[3].G)).toEqual(keys(space, ['⟨?, ?, Normal, ?, ?, ?⟩']));
    expect(keysOf(run.history[3].S)).toEqual(keys(space, ['⟨Sunny, Warm, Normal, Strong, Warm, Same⟩']));
    expect(run.history[4].G).toHaveLength(0);
    expect(run.collapsed).toBe(true);
    expect(run.collapseAt).toBe(3);
    expect(enumerateVersionSpace(space, run.final).status).toBe('empty');
    expect(classifyWithVersionSpace(space, run.final, ENJOY_SPORT_NOISY.examples[0].values).verdict).toBe('no-hypothesis');
  });

  it('contradictory labels empty the version space; a repeated example changes nothing', () => {
    const space = spaceOf(CONTRADICTION);
    const run = candidateElimination(space, CONTRADICTION.examples);
    expect(keysOf(run.history[2].S)).toEqual(keysOf(run.history[1].S));
    expect(keysOf(run.history[2].G)).toEqual(keysOf(run.history[1].G));
    expect(run.history[4].S).toHaveLength(0);
    expect(run.collapsed).toBe(true);
    expect(run.collapseAt).toBe(3);
  });

  it('a wide G boundary: four members after the first negative example', () => {
    const space = spaceOf(SHAPES_BRANCHING);
    const run = candidateElimination(space, SHAPES_BRANCHING.examples);
    expect(keysOf(run.history[2].G)).toEqual(keys(space, ['⟨circle, ?, ?, ?⟩', '⟨?, red, ?, ?⟩', '⟨?, ?, small, ?⟩', '⟨?, ?, ?, solid⟩']));
    expect(keysOf(run.history[3].G)).toEqual(keys(space, ['⟨circle, ?, ?, ?⟩', '⟨?, red, ?, ?⟩', '⟨?, ?, ?, solid⟩']));
  });

  it('convergence: S = G = {⟨circle, red, ?, ?⟩} — the concept is learnt exactly', () => {
    const space = spaceOf(SHAPES_CONVERGE);
    const final = runBoundaries(space, SHAPES_CONVERGE.examples);
    expect(keysOf(final.S)).toEqual(keys(space, ['⟨circle, red, ?, ?⟩']));
    expect(keysOf(final.G)).toEqual(keys(space, ['⟨circle, red, ?, ?⟩']));
    expect(enumerateVersionSpace(space, final).count).toBe(1);
  });
});
