/**
 * Candidate Elimination (Mitchell, 1977) — slide 74 of the course.
 *
 * The algorithm is written as pure functions over immutable boundary sets:
 *   updateS / updateG  update one boundary for one example and report every decision,
 *   processExample     applies them in the course's order,
 *   candidateElimination runs the whole dataset and records a deterministic trace
 *                      of immutable snapshots for the step-by-step simulator.
 */
import {
  bottom,
  covers,
  dedupe,
  hKey,
  keepMostGeneral,
  keepMostSpecific,
  minimalGeneralizations,
  minimalSpecializations,
  moreGeneralOrEqual,
  top,
} from './hypothesis';
import { formatHypothesis, formatInstance } from './format';
import { HypothesisSpace } from './space';
import { Cell, CEResourceError, Example, Hypothesis } from './types';

export interface Boundaries {
  S: readonly Hypothesis[];
  G: readonly Hypothesis[];
}

export interface CheckRecord {
  h: Hypothesis;
  covers: boolean;
  /** consistent with the example (covers a positive / rejects a negative). */
  consistent: boolean;
}

export interface CandidateRecord {
  h: Hypothesis;
  from: Hypothesis;
  /** restricted attribute for a specialisation; -1 = ⊥, undefined for generalisations */
  attr?: number;
  kept: boolean;
  /** the boundary element that bounds it (g ⪰ h for S, s ⪯ h for G) */
  witness?: Hypothesis;
}

export interface PruneRecord {
  h: Hypothesis;
  dominatedBy: Hypothesis;
}

export interface UpdateDetail {
  set: 'S' | 'G';
  /** filter: drop inconsistent members only. refine: replace them by minimal generalisations/specialisations. */
  kind: 'filter' | 'refine';
  before: Hypothesis[];
  checks: CheckRecord[];
  removed: Hypothesis[];
  retained: Hypothesis[];
  candidates: CandidateRecord[];
  pruned: PruneRecord[];
  after: Hypothesis[];
}

export interface CEOptions {
  /** Abort when a boundary grows beyond this size (G can grow exponentially). */
  maxBoundary?: number;
}

const DEFAULT_MAX_BOUNDARY = 5000;

function consistentWith(space: HypothesisSpace, h: Hypothesis, ex: Example) {
  const c = covers(space, h, ex.values);
  return { covers: c, consistent: c === ex.label };
}

function guard(n: number, opts?: CEOptions) {
  const max = opts?.maxBoundary ?? DEFAULT_MAX_BOUNDARY;
  if (n > max) {
    throw new CEResourceError(
      `A boundary set exceeded ${max} hypotheses. Candidate Elimination's G set can grow exponentially; reduce the number of attributes or values.`,
    );
  }
}

/**
 * Update the specific boundary S with one example.
 *  positive: every s that does not cover x is replaced by its minimal generalisations
 *            that are bounded by G, then S keeps only its most specific members;
 *  negative: every s that covers x is removed.
 */
export function updateS(space: HypothesisSpace, S: readonly Hypothesis[], G: readonly Hypothesis[], ex: Example, opts?: CEOptions): UpdateDetail {
  const checks = S.map((h) => ({ h, ...consistentWith(space, h, ex) }));
  const removed = checks.filter((c) => !c.consistent).map((c) => c.h);
  const retained = checks.filter((c) => c.consistent).map((c) => c.h);
  if (!ex.label) {
    return { set: 'S', kind: 'filter', before: [...S], checks, removed, retained, candidates: [], pruned: [], after: retained };
  }
  const candidates: CandidateRecord[] = [];
  for (const s of removed) {
    for (const h of minimalGeneralizations(space, s, ex.values)) {
      const witness = G.find((g) => moreGeneralOrEqual(space, g, h));
      candidates.push({ h, from: s, kept: Boolean(witness), witness });
    }
  }
  const merged = dedupe([...retained, ...candidates.filter((c) => c.kept).map((c) => c.h)]);
  guard(merged.length, opts);
  const { kept, pruned } = keepMostSpecific(space, merged);
  return { set: 'S', kind: 'refine', before: [...S], checks, removed, retained, candidates, pruned, after: kept };
}

/**
 * Update the general boundary G with one example.
 *  positive: every g that does not cover x is removed;
 *  negative: every g that covers x is replaced by its minimal specialisations
 *            that are bounded by S, then G keeps only its most general members.
 */
export function updateG(space: HypothesisSpace, S: readonly Hypothesis[], G: readonly Hypothesis[], ex: Example, opts?: CEOptions): UpdateDetail {
  const checks = G.map((h) => ({ h, ...consistentWith(space, h, ex) }));
  const removed = checks.filter((c) => !c.consistent).map((c) => c.h);
  const retained = checks.filter((c) => c.consistent).map((c) => c.h);
  if (ex.label) {
    return { set: 'G', kind: 'filter', before: [...G], checks, removed, retained, candidates: [], pruned: [], after: retained };
  }
  const candidates: CandidateRecord[] = [];
  for (const g of removed) {
    for (const sp of minimalSpecializations(space, g, ex.values)) {
      const witness = S.find((s) => moreGeneralOrEqual(space, sp.h, s));
      candidates.push({ h: sp.h, from: g, attr: sp.attr, kept: Boolean(witness), witness });
    }
    guard(candidates.length, opts);
  }
  const merged = dedupe([...retained, ...candidates.filter((c) => c.kept).map((c) => c.h)]);
  guard(merged.length, opts);
  const { kept, pruned } = keepMostGeneral(space, merged);
  return { set: 'G', kind: 'refine', before: [...G], checks, removed, retained, candidates, pruned, after: kept };
}

export interface ExampleDetail {
  example: Example;
  index: number;
  /** In processing order: positive → [G, S], negative → [S, G] (slide 74). */
  updates: [UpdateDetail, UpdateDetail];
  before: Boundaries;
  after: Boundaries;
}

export function processExample(space: HypothesisSpace, b: Boundaries, ex: Example, index: number, opts?: CEOptions): ExampleDetail {
  if (ex.label) {
    const dG = updateG(space, b.S, b.G, ex, opts);
    const dS = updateS(space, b.S, dG.after, ex, opts);
    return { example: ex, index, updates: [dG, dS], before: b, after: { S: dS.after, G: dG.after } };
  }
  const dS = updateS(space, b.S, b.G, ex, opts);
  const dG = updateG(space, dS.after, b.G, ex, opts);
  return { example: ex, index, updates: [dS, dG], before: b, after: { S: dS.after, G: dG.after } };
}

export function initialBoundaries(space: HypothesisSpace): Boundaries {
  return { S: [bottom(space)], G: [top(space)] };
}

export function isCollapsed(b: Boundaries): boolean {
  return b.S.length === 0 || b.G.length === 0;
}

// ───────────────────────────── trace ─────────────────────────────

export type StepPhase = 'init' | 'present' | 'filter' | 'select' | 'generate' | 'filter-candidates' | 'prune' | 'result';

export interface TraceStep {
  index: number;
  /** -1 for initialisation */
  exampleIndex: number;
  phase: StepPhase;
  /** Active pseudocode lines (see PSEUDOCODE). */
  lines: number[];
  title: string;
  simple: string;
  formal: string;
  /** Boundaries after this step (immutable snapshot). */
  S: readonly Hypothesis[];
  G: readonly Hypothesis[];
  /** Which boundary the step acts on. */
  target?: 'S' | 'G';
  focus: string[];
  added: Hypothesis[];
  removed: Hypothesis[];
  checks?: CheckRecord[];
  candidates?: (CandidateRecord & { status: 'pending' | 'kept' | 'rejected' })[];
  pruned?: PruneRecord[];
  vars: Record<string, string>;
  collapsed: boolean;
}

export interface ExampleStats {
  exampleIndex: number;
  label: boolean;
  sizeS: number;
  sizeG: number;
  generated: number;
  rejected: number;
  removed: number;
  pruned: number;
  ms: number;
}

export interface CEResult {
  steps: TraceStep[];
  /** history[0] = (S0, G0); history[i] = boundaries after example i. */
  history: Boundaries[];
  details: ExampleDetail[];
  stats: ExampleStats[];
  final: Boundaries;
  collapsed: boolean;
  /** index (0-based) of the example that emptied the version space */
  collapseAt: number | null;
  totalMs: number;
}

/** The course's pseudocode (slide 74). Line numbers are referenced by TraceStep.lines. */
export const PSEUDOCODE: { n: number; indent: number; text: string; formal: string }[] = [
  { n: 1, indent: 0, text: 'Initialise G to {⟨?, …, ?⟩}', formal: 'G₀ ← { ⊤ }' },
  { n: 2, indent: 0, text: 'Initialise S to {⟨∅, …, ∅⟩}', formal: 'S₀ ← { ⊥ }' },
  { n: 3, indent: 0, text: 'If xᵢ is a positive example', formal: 'if c(xᵢ) = 1' },
  { n: 4, indent: 1, text: 'remove from G every g that does not cover xᵢ', formal: 'G ← { g ∈ G : xᵢ ∈ cover(g) }' },
  { n: 5, indent: 1, text: 'for each s ∈ S that does not cover xᵢ', formal: 'for s ∈ S with xᵢ ∉ cover(s)' },
  { n: 6, indent: 2, text: 'remove s from S', formal: 'S ← S ∖ {s}' },
  { n: 7, indent: 2, text: 'add every minimal generalisation h of s covering xᵢ with some g ∈ G, g ⪰ h', formal: 'S ← S ∪ { h ∈ mgen(s, xᵢ) : ∃g ∈ G, h ⪯ g }' },
  { n: 8, indent: 2, text: 'remove from S every hypothesis more general than another of S', formal: 'S ← min⪯(S)' },
  { n: 9, indent: 0, text: 'If xᵢ is a negative example', formal: 'if c(xᵢ) = 0' },
  { n: 10, indent: 1, text: 'remove from S every s that covers xᵢ', formal: 'S ← { s ∈ S : xᵢ ∉ cover(s) }' },
  { n: 11, indent: 1, text: 'for each g ∈ G that covers xᵢ', formal: 'for g ∈ G with xᵢ ∈ cover(g)' },
  { n: 12, indent: 2, text: 'remove g from G', formal: 'G ← G ∖ {g}' },
  { n: 13, indent: 2, text: 'add every minimal specialisation h of g rejecting xᵢ with some s ∈ S, h ⪰ s', formal: 'G ← G ∪ { h ∈ mspec(g, xᵢ) : ∃s ∈ S, s ⪯ h }' },
  { n: 14, indent: 2, text: 'remove from G every hypothesis more specific than another of G', formal: 'G ← max⪯(G)' },
];

const list = (hs: readonly Hypothesis[]) => (hs.length === 0 ? '∅ (empty set)' : `{ ${hs.map(formatHypothesis).join(', ')} }`);
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function candidateElimination(space: HypothesisSpace, examples: readonly Example[], opts?: CEOptions): CEResult {
  const t0 = now();
  const steps: TraceStep[] = [];
  const details: ExampleDetail[] = [];
  const stats: ExampleStats[] = [];
  let b = initialBoundaries(space);
  const history: Boundaries[] = [b];
  let collapseAt: number | null = null;

  const push = (s: Omit<TraceStep, 'index' | 'collapsed'> & { collapsed?: boolean }) => {
    steps.push(Object.freeze({ ...s, index: steps.length, collapsed: s.collapsed ?? (s.S.length === 0 || s.G.length === 0) }) as TraceStep);
  };

  push({
    exampleIndex: -1,
    phase: 'init',
    lines: [1, 2],
    title: 'Initialisation',
    simple: 'G starts with the most general hypothesis (everything is positive) and S with the most specific one (nothing is positive). Every hypothesis of H lies between them, so the version space is the whole of H.',
    formal: `G₀ = { ⊤ } = ${list(b.G)},  S₀ = { ⊥ } = ${list(b.S)}.  VS₀ = { h ∈ H : ⊥ ⪯ h ⪯ ⊤ } = H.`,
    S: b.S,
    G: b.G,
    focus: [...b.S, ...b.G].map(hKey),
    added: [...b.S, ...b.G],
    removed: [],
    vars: { G: list(b.G), S: list(b.S) },
  });

  examples.forEach((ex, i) => {
    const te = now();
    const n = i + 1;
    const detail = processExample(space, b, ex, i, opts);
    details.push(detail);
    const xs = formatInstance(ex.values);
    const sign = ex.label ? 'positive' : 'negative';
    const vars0 = { i: String(n), x: xs, 'c(x)': ex.label ? '1' : '0' };

    push({
      exampleIndex: i,
      phase: 'present',
      lines: [ex.label ? 3 : 9],
      title: `Example ${n}: ${sign}`,
      simple: ex.label
        ? `x${n} = ${xs} is positive: every hypothesis we keep must cover it. G may lose members, S may have to be generalised.`
        : `x${n} = ${xs} is negative: every hypothesis we keep must reject it. S may lose members, G may have to be specialised.`,
      formal: `c(x${n}) = ${ex.label ? 1 : 0}. Consistency requires h(x${n}) = ${ex.label ? 1 : 0} for every h ∈ VS${n}.`,
      S: b.S,
      G: b.G,
      focus: [],
      added: [],
      removed: [],
      vars: { ...vars0, S: list(b.S), G: list(b.G) },
    });

    let cur: Boundaries = b;
    for (const d of detail.updates) {
      const other = d.set === 'S' ? 'G' : 'S';
      const linesFilter = d.set === 'G' ? 4 : 10;
      const withSet = (hs: readonly Hypothesis[]): Boundaries => (d.set === 'S' ? { S: hs, G: cur.G } : { S: cur.S, G: hs });
      if (d.kind === 'filter') {
        const after = withSet(d.after);
        const verb = d.set === 'G' ? 'does not cover' : 'covers';
        push({
          exampleIndex: i,
          phase: 'filter',
          lines: [linesFilter],
          target: d.set,
          title: `Remove the members of ${d.set} that are inconsistent`,
          simple:
            d.removed.length === 0
              ? `No hypothesis of ${d.set} ${verb} x${n}: nothing to change.`
              : `${d.removed.map(formatHypothesis).join(', ')} ${verb} x${n}, so ${d.removed.length === 1 ? 'it is' : 'they are'} removed from ${d.set}.`,
          formal:
            d.set === 'G'
              ? `G${n} = { g ∈ G${i} : x${n} ∈ cover(g) } = ${list(d.after)}`
              : `S${n} = { s ∈ S${i} : x${n} ∉ cover(s) } = ${list(d.after)}`,
          S: after.S,
          G: after.G,
          focus: d.before.map(hKey),
          added: [],
          removed: d.removed,
          checks: d.checks,
          vars: { ...vars0, [d.set]: list(d.after) },
        });
        cur = after;
        continue;
      }
      // refine: generalise S (positive) or specialise G (negative)
      const lines = d.set === 'S' ? { select: 5, gen: [6, 7], filt: [7], prune: 8 } : { select: 11, gen: [12, 13], filt: [13], prune: 14 };
      const op = d.set === 'S' ? 'generalisation' : 'specialisation';
      const rel = d.set === 'S' ? 'more specific than some g ∈ G' : 'more general than some s ∈ S';
      push({
        exampleIndex: i,
        phase: 'select',
        lines: [lines.select],
        target: d.set,
        title: `Find the members of ${d.set} inconsistent with x${n}`,
        simple:
          d.removed.length === 0
            ? `Every hypothesis of ${d.set} is already consistent with x${n}: nothing to ${d.set === 'S' ? 'generalise' : 'specialise'}.`
            : `${d.removed.map(formatHypothesis).join(', ')} ${d.removed.length === 1 ? (d.set === 'S' ? 'does not cover' : 'covers') : d.set === 'S' ? 'do not cover' : 'cover'} x${n} and must be ${d.set === 'S' ? 'generalised' : 'specialised'}.`,
        formal: `{ h ∈ ${d.set} : h(x${n}) ≠ c(x${n}) } = ${list(d.removed)}`,
        S: cur.S,
        G: cur.G,
        focus: d.removed.map(hKey),
        added: [],
        removed: [],
        checks: d.checks,
        vars: { ...vars0, [d.set]: list(d.before) },
      });
      if (d.removed.length > 0) {
        const mid = withSet(d.retained);
        push({
          exampleIndex: i,
          phase: 'generate',
          lines: lines.gen,
          target: d.set,
          title: `Minimal ${op}s`,
          simple:
            d.set === 'S'
              ? `Each inconsistent s is removed and replaced by the smallest change that covers x${n}: on every attribute where s disagrees with x${n}, the constraint is relaxed just enough (a value becomes ? or a common group, an interval is stretched to include the value).`
              : `Each inconsistent g is removed. Its minimal specialisations restrict exactly one attribute, as little as possible, so that x${n} is rejected: ${d.candidates.length} candidate${d.candidates.length === 1 ? '' : 's'} generated.`,
          formal:
            d.set === 'S'
              ? `mgen(s, x${n}) = least h ⪰ s with x${n} ∈ cover(h): ${list(d.candidates.map((c) => c.h))}`
              : `mspec(g, x${n}) = max⪯ { h ≺ g : x${n} ∉ cover(h) } = ${list(d.candidates.map((c) => c.h))}`,
          S: mid.S,
          G: mid.G,
          focus: d.candidates.map((c) => hKey(c.h)),
          added: [],
          removed: d.removed,
          candidates: d.candidates.map((c) => ({ ...c, status: 'pending' as const })),
          vars: { ...vars0, [d.set]: list(d.retained), candidates: String(d.candidates.length) },
        });
        const keptH = d.candidates.filter((c) => c.kept).map((c) => c.h);
        const beforePrune = withSet(dedupe([...d.retained, ...keptH]));
        const rejected = d.candidates.filter((c) => !c.kept);
        push({
          exampleIndex: i,
          phase: 'filter-candidates',
          lines: lines.filt,
          target: d.set,
          title: `Keep only candidates bounded by ${other}`,
          simple:
            rejected.length === 0
              ? `Every candidate is ${rel}, so all of them are kept.`
              : `A candidate is kept only if it is ${rel}; otherwise no consistent hypothesis could lie between it and ${other}. ${rejected.length} rejected, ${keptH.length} kept.`,
          formal:
            d.set === 'S'
              ? `keep h iff ∃g ∈ G: h ⪯ g. Kept: ${list(keptH)}`
              : `keep h iff ∃s ∈ S: s ⪯ h. Kept: ${list(keptH)}`,
          S: beforePrune.S,
          G: beforePrune.G,
          focus: d.candidates.map((c) => hKey(c.h)),
          added: keptH,
          removed: rejected.map((c) => c.h),
          candidates: d.candidates.map((c) => ({ ...c, status: c.kept ? ('kept' as const) : ('rejected' as const) })),
          vars: { ...vars0, [d.set]: list(beforePrune[d.set]) },
        });
        const after = withSet(d.after);
        push({
          exampleIndex: i,
          phase: 'prune',
          lines: [lines.prune],
          target: d.set,
          title: `Remove redundant members of ${d.set}`,
          simple:
            d.pruned.length === 0
              ? `No member of ${d.set} is ${d.set === 'S' ? 'more general' : 'more specific'} than another one: nothing is redundant.`
              : `${d.pruned.map((p) => formatHypothesis(p.h)).join(', ')} ${d.pruned.length === 1 ? 'is' : 'are'} ${d.set === 'S' ? 'more general' : 'more specific'} than another member of ${d.set} and ${d.pruned.length === 1 ? 'is' : 'are'} not on the boundary.`,
          formal: `${d.set}${n} = ${d.set === 'S' ? 'min' : 'max'}⪯(${d.set}) = ${list(d.after)}`,
          S: after.S,
          G: after.G,
          focus: d.after.map(hKey),
          added: [],
          removed: d.pruned.map((p) => p.h),
          pruned: d.pruned,
          vars: { ...vars0, [d.set]: list(d.after) },
        });
      }
      cur = withSet(d.after);
    }

    b = detail.after;
    history.push(b);
    const collapsed = isCollapsed(b);
    if (collapsed && collapseAt === null) collapseAt = i;
    push({
      exampleIndex: i,
      phase: 'result',
      lines: [],
      title: collapsed ? `Version space after example ${n}: empty` : `Version space after example ${n}`,
      simple: collapsed
        ? `The version space is empty: no hypothesis of H is consistent with all the examples seen. Either the examples contain an error, or the target concept cannot be written in this hypothesis language.`
        : `S${n} and G${n} now delimit every hypothesis consistent with the first ${n} example${n === 1 ? '' : 's'}.`,
      formal: `S${n} = ${list(b.S)},  G${n} = ${list(b.G)}.  VS${n} = { h : ∃s ∈ S${n}, ∃g ∈ G${n}, s ⪯ h ⪯ g }${collapsed ? ' = ∅' : ''}.`,
      S: b.S,
      G: b.G,
      focus: [...b.S, ...b.G].map(hKey),
      added: [],
      removed: [],
      vars: { ...vars0, S: list(b.S), G: list(b.G) },
    });
    const all = detail.updates;
    stats.push({
      exampleIndex: i,
      label: ex.label,
      sizeS: b.S.length,
      sizeG: b.G.length,
      generated: all.reduce((a, d) => a + d.candidates.length, 0),
      rejected: all.reduce((a, d) => a + d.candidates.filter((c) => !c.kept).length, 0),
      removed: all.reduce((a, d) => a + d.removed.length, 0),
      pruned: all.reduce((a, d) => a + d.pruned.length, 0),
      ms: now() - te,
    });
  });

  return {
    steps,
    history,
    details,
    stats,
    final: b,
    collapsed: isCollapsed(b),
    collapseAt,
    totalMs: now() - t0,
  };
}

/** Run without building the trace (used by tests and the API). */
export function runBoundaries(space: HypothesisSpace, examples: readonly Example[], opts?: CEOptions): Boundaries {
  let b = initialBoundaries(space);
  examples.forEach((ex, i) => {
    b = processExample(space, b, ex, i, opts).after;
  });
  return b;
}

export type { Cell };
