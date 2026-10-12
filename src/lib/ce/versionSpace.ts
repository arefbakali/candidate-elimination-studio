/**
 * Version space enumeration, lattice (Hasse diagram) construction and classification.
 */
import { Boundaries } from './algorithm';
import { bottom, canonicalize, covers, hKey, isBottom, moreGeneralOrEqual, strictlyMoreGeneral, top } from './hypothesis';
import { HypothesisSpace, NONE } from './space';
import { Cell, Constraint, Hypothesis } from './types';

export type VSStatus = 'complete' | 'too-large' | 'infinite' | 'empty';

export interface VSEnumeration {
  status: VSStatus;
  /** All members (status = complete) — otherwise empty. */
  hypotheses: Hypothesis[];
  /** Exact size when complete; an upper bound of the candidates scanned otherwise (Infinity if infinite). */
  count: number;
  /** true when `count` is exact. */
  exact: boolean;
}

export function inVersionSpace(space: HypothesisSpace, b: Boundaries, h: Hypothesis): boolean {
  return b.S.some((s) => moreGeneralOrEqual(space, h, s)) && b.G.some((g) => moreGeneralOrEqual(space, g, h));
}

/**
 * Enumerate VS = { h ∈ H : ∃s ∈ S, ∃g ∈ G, s ⪯ h ⪯ g } exactly.
 * For each pair (s, g) with s ⪯ g the members between them form a product of
 * per-attribute intervals of the constraint lattices; their union is deduplicated.
 */
export function enumerateVersionSpace(space: HypothesisSpace, b: Boundaries, limit = 20000): VSEnumeration {
  if (b.S.length === 0 || b.G.length === 0) return { status: 'empty', hypotheses: [], count: 0, exact: true };
  const seen = new Map<string, Hypothesis>();
  let scanned = 0;
  for (const s of b.S) {
    for (const g of b.G) {
      if (!moreGeneralOrEqual(space, g, s)) continue;
      if (isBottom(g)) {
        seen.set(hKey(g), g);
        continue;
      }
      const lowers: Constraint[] = isBottom(s) ? space.attributes.map(() => NONE) : [...s];
      const counts = space.lattices.map((lat, i) => lat.countBetween(lowers[i], g[i]));
      if (counts.some((c) => !Number.isFinite(c))) return { status: 'infinite', hypotheses: [], count: Infinity, exact: false };
      const product = counts.reduce((a, c) => a * c, 1);
      scanned += product + (isBottom(s) ? 1 : 0);
      if (scanned > limit) return { status: 'too-large', hypotheses: [], count: scanned, exact: false };
      if (isBottom(s)) seen.set(hKey(s), s);
      const options = space.lattices.map((lat, i) => lat.listBetween(lowers[i], g[i]));
      const idx = options.map(() => 0);
      if (options.some((o) => o.length === 0)) continue;
      for (;;) {
        const h = canonicalize(
          space,
          idx.map((k, i) => options[i][k]),
        );
        seen.set(hKey(h), h);
        let p = 0;
        while (p < idx.length) {
          idx[p]++;
          if (idx[p] < options[p].length) break;
          idx[p] = 0;
          p++;
        }
        if (p === idx.length) break;
      }
    }
  }
  const hypotheses = [...seen.values()];
  return { status: 'complete', hypotheses, count: hypotheses.length, exact: true };
}

// ───────────────────────────── lattice ─────────────────────────────

export type NodeRole = 'G' | 'S' | 'member' | 'top' | 'bottom' | 'sample' | 'removed';

export interface LatticeNode {
  id: string;
  h: Hypothesis;
  roles: NodeRole[];
  inVS: boolean;
  /** Number of constrained attributes (0 = ⊤), a generality rank. */
  rank: number;
  label?: string;
}

export interface LatticeEdge {
  id: string;
  /** more specific hypothesis */
  source: string;
  /** more general hypothesis */
  target: string;
  /**
   * cover   : immediate generalisation inside the version space (Hasse edge)
   * order   : s ≺ g in the displayed partial graph (intermediate members hidden)
   * outside : link to ⊤ / ⊥, which lie outside the version space
   */
  kind: 'cover' | 'order' | 'outside';
  /** attribute indices whose constraint changes along the edge */
  changed: number[];
}

export interface Lattice {
  mode: 'complete' | 'boundary';
  nodes: LatticeNode[];
  edges: LatticeEdge[];
  vs: VSEnumeration;
  /** reason why the graph is partial */
  note?: string;
}

export interface LatticeOptions {
  maxNodes?: number;
  samples?: { label: string; h: Hypothesis }[];
  removed?: Hypothesis[];
  enumerationLimit?: number;
}

function rankOf(h: Hypothesis): number {
  if (isBottom(h)) return h.length + 1;
  return h.filter((c) => c.t !== 'any').length;
}

/** Transitive reduction of the strict generality order restricted to `hs`. */
function hasseEdges(space: HypothesisSpace, hs: Hypothesis[]): [number, number][] {
  const n = hs.length;
  const gt: boolean[][] = hs.map((a) => hs.map((b) => a !== b && strictlyMoreGeneral(space, a, b)));
  const edges: [number, number][] = [];
  for (let lo = 0; lo < n; lo++) {
    for (let hi = 0; hi < n; hi++) {
      if (!gt[hi][lo]) continue;
      let covered = true;
      for (let k = 0; k < n; k++) {
        if (gt[hi][k] && gt[k][lo]) {
          covered = false;
          break;
        }
      }
      if (covered) edges.push([lo, hi]);
    }
  }
  return edges;
}

function changedAttrs(a: Hypothesis, b: Hypothesis): number[] {
  if (isBottom(a) || isBottom(b)) return a.map((_, i) => i);
  return a.map((c, i) => (hKey([c]) === hKey([b[i]]) ? -1 : i)).filter((i) => i >= 0);
}

export function buildLattice(space: HypothesisSpace, b: Boundaries, opts: LatticeOptions = {}): Lattice {
  const maxNodes = opts.maxNodes ?? 160;
  const vs = enumerateVersionSpace(space, b, opts.enumerationLimit ?? 20000);
  const T = top(space);
  const B = bottom(space);
  const keyS = new Set(b.S.map(hKey));
  const keyG = new Set(b.G.map(hKey));
  const nodes = new Map<string, LatticeNode>();
  const add = (h: Hypothesis, role: NodeRole, inVS: boolean, label?: string) => {
    const id = hKey(h);
    const existing = nodes.get(id);
    if (existing) {
      if (!existing.roles.includes(role)) existing.roles.push(role);
      if (label && !existing.label) existing.label = label;
      return existing;
    }
    const node: LatticeNode = { id, h, roles: [role], inVS, rank: rankOf(h), label };
    nodes.set(id, node);
    return node;
  };
  const complete = vs.status === 'complete' && vs.count <= maxNodes;
  let note: string | undefined;
  if (complete) {
    for (const h of vs.hypotheses) {
      const k = hKey(h);
      add(h, keyG.has(k) ? 'G' : keyS.has(k) ? 'S' : 'member', true);
    }
    for (const s of b.S) add(s, 'S', true);
    for (const g of b.G) add(g, 'G', true);
  } else {
    for (const g of b.G) add(g, 'G', true);
    for (const s of b.S) add(s, 'S', true);
    if (vs.status === 'empty') note = 'The version space is empty.';
    else if (vs.status === 'infinite') note = 'The version space is infinite (unbounded interval constraints): only the boundaries and verified sample members are drawn.';
    else if (vs.status === 'too-large') note = `The version space has more than ${opts.enumerationLimit ?? 20000} hypotheses: only the boundaries are drawn.`;
    else note = `The version space has ${vs.count} hypotheses (more than ${maxNodes}): only the boundaries are drawn.`;
  }
  for (const smp of opts.samples ?? []) {
    const h = canonicalize(space, smp.h);
    if (inVersionSpace(space, b, h)) add(h, 'sample', true, smp.label);
  }
  const vsNodes = [...nodes.values()].filter((n) => n.inVS);
  const reduced = hasseEdges(
    space,
    vsNodes.map((n) => n.h),
  );
  const edges: LatticeEdge[] = reduced.map(([lo, hi]) => {
    const a = vsNodes[lo];
    const c = vsNodes[hi];
    return { id: `${a.id}→${c.id}`, source: a.id, target: c.id, kind: complete ? 'cover' : 'order', changed: changedAttrs(a.h, c.h) };
  });
  // ⊤ and ⊥ anchors (outside the version space unless they belong to it)
  if (vs.status !== 'empty') {
    if (!nodes.has(hKey(T))) {
      add(T, 'top', false);
      const maximal = vsNodes.filter((n) => !vsNodes.some((m) => m !== n && strictlyMoreGeneral(space, m.h, n.h)));
      for (const m of maximal) edges.push({ id: `${m.id}→⊤`, source: m.id, target: hKey(T), kind: 'outside', changed: changedAttrs(m.h, T) });
    } else nodes.get(hKey(T))!.roles.push('top');
    if (!nodes.has(hKey(B))) {
      add(B, 'bottom', false);
      const minimal = vsNodes.filter((n) => !vsNodes.some((m) => m !== n && strictlyMoreGeneral(space, n.h, m.h)));
      for (const m of minimal) edges.push({ id: `⊥→${m.id}`, source: hKey(B), target: m.id, kind: 'outside', changed: changedAttrs(B, m.h) });
    } else nodes.get(hKey(B))!.roles.push('bottom');
  }
  for (const r of opts.removed ?? []) {
    const k = hKey(r);
    if (!nodes.has(k)) add(r, 'removed', false);
  }
  return { mode: complete ? 'complete' : 'boundary', nodes: [...nodes.values()], edges, vs, note };
}

// ───────────────────────────── classification ─────────────────────────────

export type Verdict = 'positive' | 'negative' | 'undetermined' | 'no-hypothesis';

export interface ConstraintCheck {
  attr: number;
  satisfied: boolean;
}

export interface HypothesisVote {
  h: Hypothesis;
  set: 'S' | 'G' | 'member';
  covers: boolean;
  checks: ConstraintCheck[];
}

export interface Classification {
  verdict: Verdict;
  reason: string;
  boundaryVotes: HypothesisVote[];
  /** Exact counts over the whole version space when it could be enumerated. */
  exactVotes?: { positive: number; negative: number; total: number };
}

function vote(space: HypothesisSpace, h: Hypothesis, set: HypothesisVote['set'], x: readonly Cell[]): HypothesisVote {
  const checks = h.map((c, i) => ({ attr: i, satisfied: space.lattices[i].covers(c, x[i]) }));
  return { h, set, covers: checks.every((c) => c.satisfied), checks };
}

/**
 * Slides 86–87: x is positive for the whole version space iff every s ∈ S covers x
 * (every member is ⪰ some s); negative iff no g ∈ G covers x (every member is ⪯ some g).
 */
export function classifyWithVersionSpace(space: HypothesisSpace, b: Boundaries, x: readonly Cell[], enumeration?: VSEnumeration): Classification {
  const boundaryVotes = [...b.G.map((h) => vote(space, h, 'G', x)), ...b.S.map((h) => vote(space, h, 'S', x))];
  if (b.S.length === 0 || b.G.length === 0) {
    return { verdict: 'no-hypothesis', reason: 'The version space is empty: no hypothesis of H is consistent with the training data.', boundaryVotes };
  }
  let exactVotes: Classification['exactVotes'];
  if (enumeration && enumeration.status === 'complete') {
    const pos = enumeration.hypotheses.filter((h) => covers(space, h, x)).length;
    exactVotes = { positive: pos, negative: enumeration.count - pos, total: enumeration.count };
  }
  const allS = b.S.every((s) => covers(space, s, x));
  const anyG = b.G.some((g) => covers(space, g, x));
  if (allS) return { verdict: 'positive', reason: 'Every member of S covers x, so every hypothesis of the version space (all are ⪰ some s ∈ S) classifies it positive.', boundaryVotes, exactVotes };
  if (!anyG) return { verdict: 'negative', reason: 'No member of G covers x, so no hypothesis of the version space (all are ⪯ some g ∈ G) classifies it positive.', boundaryVotes, exactVotes };
  return {
    verdict: 'undetermined',
    reason: 'Some member of G covers x but not every member of S does: hypotheses of the version space disagree, so x cannot be classified with certainty.',
    boundaryVotes,
    exactVotes,
  };
}

export { isBottom };
