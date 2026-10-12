import { describe, expect, it } from 'vitest';
import {
  bottom,
  CEResourceError,
  CEValidationError,
  candidateElimination,
  covers,
  createSpace,
  formatHypothesis,
  hKey,
  minimalGeneralizations,
  minimalSpecializations,
  moreGeneralOrEqual,
  parseHypothesis,
  runBoundaries,
  top,
} from '../../src/lib/ce';
import { BIRDS, SPORT } from '../../src/lib/datasets';
import { spaceOf } from './helpers';

describe('covers / moreGeneralOrEqual', () => {
  const space = spaceOf(SPORT);
  const p = (s: string) => parseHypothesis(space, s);
  it('⊤ covers every instance and ⊥ none', () => {
    const x = SPORT.examples[0].values;
    expect(covers(space, top(space), x)).toBe(true);
    expect(covers(space, bottom(space), x)).toBe(false);
  });
  it('any hypothesis containing ∅ is canonicalised to ⊥', () => {
    expect(hKey(p('⟨football, ∅, ?, ?, ?⟩'))).toBe('⊥');
  });
  it('the generality order is a partial order compatible with coverage', () => {
    const a = p('⟨?, team, ?, ?, ?⟩');
    const b = p('⟨?, team, ?, national, ?⟩');
    const c = p('⟨?, ?, ?, national, ?⟩');
    expect(moreGeneralOrEqual(space, a, b)).toBe(true);
    expect(moreGeneralOrEqual(space, b, a)).toBe(false);
    expect(moreGeneralOrEqual(space, a, c)).toBe(false);
    expect(moreGeneralOrEqual(space, c, a)).toBe(false);
    expect(moreGeneralOrEqual(space, a, a)).toBe(true);
    expect(moreGeneralOrEqual(space, a, bottom(space))).toBe(true);
    expect(moreGeneralOrEqual(space, top(space), a)).toBe(true);
  });
});

describe('minimal generalisation and specialisation', () => {
  it('generalising ⊥ gives the example itself', () => {
    const space = spaceOf(SPORT);
    const x = SPORT.examples[0].values;
    expect(minimalGeneralizations(space, bottom(space), x).map(formatHypothesis)).toEqual(['⟨football, team, outdoor, national, Saturday⟩']);
  });
  it('hierarchy: the least common group of russet and orange is warm colour', () => {
    const space = spaceOf(BIRDS);
    const s = parseHypothesis(space, '(True, [30, 30], russet)');
    expect(minimalGeneralizations(space, s, ['True', 40, 'orange']).map(formatHypothesis)).toEqual(['⟨True, [30, 40], warm colour⟩']);
    expect(minimalGeneralizations(space, s, ['True', 20, 'grey']).map(formatHypothesis)).toEqual(['⟨True, [20, 30], ?⟩']);
  });
  it('a group with a single member is equivalent to that member', () => {
    const space = spaceOf(BIRDS);
    expect(hKey(parseHypothesis(space, '(?, ?, grey)'))).toBe(hKey(parseHypothesis(space, '(?, ?, cold colour)')));
  });
  it('specialising an interval splits it around the excluded value', () => {
    const space = spaceOf(BIRDS);
    const g = parseHypothesis(space, '(?, [10, 20], ?)');
    const sp = minimalSpecializations(space, g, ['True', 10, 'grey']).map((s) => formatHypothesis(s.h));
    expect(sp).toContain('⟨?, [11, 20], ?⟩');
    expect(sp).not.toContain('⟨?, [10, 9], ?⟩');
  });
  it('when no attribute can be specialised the only minimal specialisation is ⊥', () => {
    const space = createSpace([{ kind: 'categorical', name: 'A', values: ['a'] }]);
    const sp = minimalSpecializations(space, top(space), ['a']);
    expect(sp.map((s) => hKey(s.h))).toEqual(['⊥']);
  });
});

describe('missing values (typed null)', () => {
  const space = createSpace([
    { kind: 'categorical', name: 'A', values: ['a', 'b'] },
    { kind: 'categorical', name: 'B', values: ['x', 'y'] },
  ]);
  it('only ? covers a missing value', () => {
    expect(covers(space, parseHypothesis(space, '⟨?, ?⟩'), [null, 'x'])).toBe(true);
    expect(covers(space, parseHypothesis(space, '⟨a, ?⟩'), [null, 'x'])).toBe(false);
  });
  it('a positive example with a missing value generalises that attribute to ?', () => {
    const b = runBoundaries(space, [
      { id: '1', values: ['a', 'x'], label: true },
      { id: '2', values: [null, 'x'], label: true },
    ]);
    expect(b.S.map(formatHypothesis)).toEqual(['⟨?, x⟩']);
  });
  it('a negative example with a missing value can be rejected by any specific constraint', () => {
    const b = runBoundaries(space, [{ id: '1', values: [null, 'x'], label: false }]);
    expect(b.G.map(formatHypothesis).sort()).toEqual(['⟨?, y⟩', '⟨a, ?⟩', '⟨b, ?⟩']);
  });
});

describe('validation and resource limits', () => {
  it('rejects malformed hierarchies', () => {
    expect(() =>
      createSpace([{ kind: 'categorical', name: 'C', values: ['a', 'b'], hierarchy: [{ name: 'g1', members: ['a'] }, { name: 'g2', members: ['a', 'b'] }] }]),
    ).toThrow(CEValidationError);
  });
  it('rejects duplicate attribute names', () => {
    expect(() =>
      createSpace([
        { kind: 'categorical', name: 'A', values: ['a'] },
        { kind: 'categorical', name: 'A', values: ['b'] },
      ]),
    ).toThrow(CEValidationError);
  });
  it('stops cleanly when G explodes beyond the configured limit', () => {
    const attrs = Array.from({ length: 8 }, (_, i) => ({ kind: 'categorical' as const, name: `A${i}`, values: ['0', '1', '2', '3'] }));
    const space = createSpace(attrs);
    const ex = (v: string, label: boolean, id: string) => ({ id, values: attrs.map(() => v), label });
    expect(() => candidateElimination(space, [ex('0', false, 'a'), ex('1', false, 'b'), ex('2', false, 'c')], { maxBoundary: 50 })).toThrow(CEResourceError);
  });
});
