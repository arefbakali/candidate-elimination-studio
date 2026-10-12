import { isBottom } from './hypothesis';
import { HypothesisSpace } from './space';
import { Cell, Constraint, Hypothesis } from './types';

function num(x: number): string {
  if (x === Infinity) return '+∞';
  if (x === -Infinity) return '−∞';
  return String(x);
}

export function formatConstraint(c: Constraint): string {
  switch (c.t) {
    case 'any':
      return '?';
    case 'none':
      return '∅';
    case 'val':
      return c.v;
    case 'grp':
      return c.g;
    case 'int': {
      const left = c.lo === -Infinity ? ']' : '[';
      const right = c.hi === Infinity ? '[' : ']';
      return `${left}${num(c.lo)}, ${num(c.hi)}${right}`;
    }
  }
}

/** ⟨?, team, ?, national, Saturday⟩ */
export function formatHypothesis(h: Hypothesis): string {
  return `⟨${h.map(formatConstraint).join(', ')}⟩`;
}

/** Short name: ⊤ / ⊥ / the tuple. */
export function formatHypothesisShort(h: Hypothesis): string {
  if (isBottom(h)) return '⊥';
  if (h.every((c) => c.t === 'any')) return '⊤';
  return formatHypothesis(h);
}

export function formatCell(v: Cell): string {
  return v === null ? '∅ (missing)' : String(v);
}

export function formatInstance(x: readonly Cell[]): string {
  return `(${x.map((v) => (v === null ? 'missing' : String(v))).join(', ')})`;
}

/** Plain-ASCII/WinAnsi rendering used by the PDF and CSV exports. */
export function asciiHypothesis(h: Hypothesis): string {
  return formatHypothesis(h)
    .replace(/⟨/g, '<')
    .replace(/⟩/g, '>')
    .replace(/∅/g, 'Ø')
    .replace(/\+∞/g, '+inf')
    .replace(/−∞/g, '-inf');
}

export function describeHypothesis(space: HypothesisSpace, h: Hypothesis): string {
  if (isBottom(h)) return 'covers no instance';
  const parts = h
    .map((c, i) => (c.t === 'any' ? null : `${space.attributes[i].name} ∈ ${space.lattices[i].describe(c)}`))
    .filter(Boolean);
  return parts.length === 0 ? 'covers every instance' : parts.join(' ∧ ');
}
