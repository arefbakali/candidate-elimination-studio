import { describe, expect, it } from 'vitest';
import { candidateElimination, enumerateVersionSpace, buildLattice } from '../../src/lib/ce';
import { SPORT } from '../../src/lib/datasets';
import { keys, keysOf, spaceOf } from './helpers';

const space = spaceOf(SPORT);
const run = candidateElimination(space, SPORT.examples);
const H = run.history;

describe('Sport dataset — course slides 73–78', () => {
  it('initialises S0 = {⟨∅,…,∅⟩} and G0 = {⟨?,…,?⟩} (slide 75)', () => {
    expect(keysOf(H[0].S)).toEqual(keys(space, ['⟨∅, ∅, ∅, ∅, ∅⟩']));
    expect(keysOf(H[0].G)).toEqual(keys(space, ['⟨?, ?, ?, ?, ?⟩']));
  });

  it('example 1 (positive): S1 is the example itself, G1 unchanged', () => {
    expect(keysOf(H[1].S)).toEqual(keys(space, ['⟨football, team, outdoor, national, Saturday⟩']));
    expect(keysOf(H[1].G)).toEqual(keys(space, ['⟨?, ?, ?, ?, ?⟩']));
  });

  it('example 2 (positive): S2 = ⟨?, team, outdoor, national, Saturday⟩', () => {
    expect(keysOf(H[2].S)).toEqual(keys(space, ['⟨?, team, outdoor, national, Saturday⟩']));
    expect(keysOf(H[2].G)).toEqual(keys(space, ['⟨?, ?, ?, ?, ?⟩']));
  });

  it('example 3 (negative): G3 has the three specialisations of slide 75', () => {
    expect(keysOf(H[3].S)).toEqual(keys(space, ['⟨?, team, outdoor, national, Saturday⟩']));
    expect(keysOf(H[3].G)).toEqual(keys(space, ['⟨?, team, ?, ?, ?⟩', '⟨?, ?, outdoor, ?, ?⟩', '⟨?, ?, ?, national, ?⟩']));
  });

  it('example 3: specialisations on Sport and Day are generated but rejected (notes 1 and 2)', () => {
    const dG = run.details[2].updates[1];
    expect(dG.set).toBe('G');
    // 4 other sports + 1 type + 1 place + 1 level + 6 other days
    expect(dG.candidates).toHaveLength(13);
    const kept = dG.candidates.filter((c) => c.kept).map((c) => c.attr);
    expect(kept.sort()).toEqual([1, 2, 3]);
    const rejectedAttrs = new Set(dG.candidates.filter((c) => !c.kept).map((c) => c.attr));
    expect([...rejectedAttrs].sort()).toEqual([0, 4]);
  });

  it('example 4 (positive): ⟨?, ?, outdoor, ?, ?⟩ is removed and place is generalised (slide 76)', () => {
    expect(keysOf(H[4].G)).toEqual(keys(space, ['⟨?, team, ?, ?, ?⟩', '⟨?, ?, ?, national, ?⟩']));
    expect(keysOf(H[4].S)).toEqual(keys(space, ['⟨?, team, ?, national, Saturday⟩']));
  });

  it('example 5 (negative): nothing changes', () => {
    expect(keysOf(H[5].S)).toEqual(keys(space, ['⟨?, team, ?, national, Saturday⟩']));
    expect(keysOf(H[5].G)).toEqual(keys(space, ['⟨?, team, ?, ?, ?⟩', '⟨?, ?, ?, national, ?⟩']));
    expect(run.collapsed).toBe(false);
  });

  it('the final version space contains exactly the 6 hypotheses of slide 77', () => {
    const vs = enumerateVersionSpace(space, run.final);
    expect(vs.status).toBe('complete');
    expect(vs.count).toBe(6);
    expect(keysOf(vs.hypotheses)).toEqual(
      keys(space, [
        '⟨?, ?, ?, national, ?⟩',
        '⟨?, team, ?, ?, ?⟩',
        '⟨?, team, ?, national, ?⟩',
        '⟨?, team, ?, ?, Saturday⟩',
        '⟨?, ?, ?, national, Saturday⟩',
        '⟨?, team, ?, national, Saturday⟩',
      ]),
    );
  });

  it('⟨?, ?, ?, ?, Saturday⟩ is not in the version space (it covers the gymnastics example)', () => {
    const vs = enumerateVersionSpace(space, run.final);
    expect(keysOf(vs.hypotheses)).not.toContain(keys(space, ['⟨?, ?, ?, ?, Saturday⟩'])[0]);
  });

  it('the final lattice is the diamond of slide 77: 6 nodes and 7 cover edges inside the version space', () => {
    const lat = buildLattice(space, run.final);
    expect(lat.mode).toBe('complete');
    const inside = lat.nodes.filter((n) => n.inVS);
    expect(inside).toHaveLength(6);
    const cover = lat.edges.filter((e) => e.kind === 'cover');
    // S → 3 middle hypotheses, middle → G: team·national → both G, team·Saturday → team, national·Saturday → national
    expect(cover).toHaveLength(7);
    for (const e of cover) expect(e.changed).toHaveLength(1);
    // ⊤ and ⊥ are drawn outside the version space
    expect(lat.nodes.filter((n) => !n.inVS).map((n) => n.roles[0]).sort()).toEqual(['bottom', 'top']);
  });

  it('the PAC size of H on slide 78 is 1297', () => {
    const vs = enumerateVersionSpace(space, { S: H[0].S, G: H[0].G }, 5000);
    expect(vs.status).toBe('complete');
    expect(vs.count).toBe(6 * 3 * 3 * 3 * 8 + 1);
  });
});
