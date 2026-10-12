/**
 * Scripted five-minute demonstration. Scenes point at real trace steps and
 * their narration is generated from the computed boundaries.
 */
import { CEResult, TraceStep } from './ce/algorithm';
import { formatHypothesis, formatInstance } from './ce/format';
import { HypothesisSpace } from './ce/space';
import { Dataset } from './ce/types';
import { enumerateVersionSpace } from './ce/versionSpace';

export interface Scene {
  title: string;
  narration: string;
  step: number;
  reveal?: boolean;
  seconds: number;
}

const set = (hs: readonly unknown[], f: (h: never) => string) => `{ ${(hs as never[]).map(f).join(', ')} }`;

export function buildScenes(ds: Dataset, space: HypothesisSpace, r: CEResult): Scene[] {
  const find = (ex: number, phase: TraceStep['phase']) => r.steps.find((s) => s.exampleIndex === ex && s.phase === phase);
  const resultOf = (ex: number) => find(ex, 'result')!;
  const scenes: Scene[] = [];
  const S = (s: TraceStep) => set(s.S, formatHypothesis);
  const G = (s: TraceStep) => set(s.G, formatHypothesis);
  scenes.push({
    title: `The ${ds.name} dataset`,
    narration: `${ds.examples.length} training examples described by ${ds.attributes.length} attributes (${ds.attributes.map((a) => a.name).join(', ')}). We want every conjunctive hypothesis consistent with all of them.`,
    step: 0,
    seconds: 25,
  });
  const init = r.steps[0];
  scenes.push({
    title: 'S₀ and G₀',
    narration: `G₀ = ${G(init)} accepts everything; S₀ = ${S(init)} accepts nothing. Every hypothesis of H lies between them: the version space starts as the whole of H.`,
    step: 0,
    seconds: 30,
  });
  const firstPos = ds.examples.findIndex((e) => e.label);
  if (firstPos >= 0) {
    const st = resultOf(firstPos);
    scenes.push({
      title: `Example ${firstPos + 1}: a positive example`,
      narration: `${formatInstance(ds.examples[firstPos].values)} is positive. G already covers it. S is generalised minimally: S${firstPos + 1} = ${S(st)}.`,
      step: st.index,
      seconds: 30,
    });
  }
  const secondPos = ds.examples.findIndex((e, i) => e.label && i > firstPos);
  if (secondPos >= 0) {
    const gen = find(secondPos, 'filter-candidates') ?? resultOf(secondPos);
    scenes.push({
      title: 'Minimal generalisation',
      narration: `Example ${secondPos + 1} is positive but not covered by S. Only the attributes that disagree are relaxed, as little as possible: S${secondPos + 1} = ${S(resultOf(secondPos))}.`,
      step: gen.index,
      seconds: 30,
    });
  }
  const firstNeg = ds.examples.findIndex((e) => !e.label);
  if (firstNeg >= 0) {
    const present = find(firstNeg, 'present')!;
    scenes.push({
      title: `Example ${firstNeg + 1}: a negative example`,
      narration: `${formatInstance(ds.examples[firstNeg].values)} must be rejected. S does not cover it, but G = ${G(present)} does, so G must be specialised.`,
      step: present.index,
      seconds: 25,
    });
    const filt = find(firstNeg, 'filter-candidates');
    if (filt) {
      const kept = filt.candidates!.filter((c) => c.kept).length;
      scenes.push({
        title: 'Specialising G',
        narration: `Each minimal specialisation restricts one attribute so that the example is rejected: ${filt.candidates!.length} candidates. Only those more general than S survive (${kept} kept); the others could never contain S.`,
        step: filt.index,
        seconds: 40,
      });
    }
    const res = resultOf(firstNeg);
    scenes.push({
      title: 'Updated boundaries',
      narration: `After example ${firstNeg + 1}: S${firstNeg + 1} = ${S(res)} and G${firstNeg + 1} = ${G(res)}.`,
      step: res.index,
      seconds: 25,
    });
  }
  const lastShown = Math.max(firstPos, secondPos, firstNeg);
  for (let i = lastShown + 1; i < ds.examples.length; i++) {
    const res = resultOf(i);
    const d = r.details[i];
    const changed = d.updates.flatMap((u) => u.removed).length;
    scenes.push({
      title: `Example ${i + 1}: ${d.example.label ? 'positive' : 'negative'}`,
      narration: `${formatInstance(d.example.values)}. ${changed === 0 ? 'Every boundary hypothesis is already consistent: nothing changes.' : `${changed} boundary hypothesis${changed === 1 ? ' is' : 'es are'} inconsistent and updated.`} S${i + 1} = ${S(res)}, G${i + 1} = ${G(res)}.`,
      step: res.index,
      seconds: 25,
    });
  }
  const last = r.steps[r.steps.length - 1];
  const vs = enumerateVersionSpace(space, r.final);
  scenes.push({
    title: r.collapsed ? 'The version space is empty' : 'Final version space',
    narration: r.collapsed
      ? 'No hypothesis is consistent with every example: the data contain an error or the concept is outside H.'
      : vs.status === 'complete'
        ? `The final version space contains exactly ${vs.count} hypothes${vs.count === 1 ? 'is' : 'es'}: every h with s ⪯ h ⪯ g for some s ∈ S and g ∈ G.`
        : 'The final version space is delimited by S and G.',
    step: last.index,
    reveal: true,
    seconds: 30,
  });
  if (!r.collapsed) {
    scenes.push({
      title: 'Reading the diamond',
      narration: `S = ${S(last)} is at the bottom, G = ${G(last)} at the top. Each arrow is one minimal generalisation (one constraint replaced by a more general one). Every path from S to G stays inside the version space, and ⊤ / ⊥ lie outside it.`,
      step: last.index,
      seconds: 40,
    });
  }
  return scenes;
}
