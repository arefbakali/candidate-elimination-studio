import { canonicalize } from './hypothesis';
import { HypothesisSpace } from './space';
import { CEValidationError, Constraint, Hypothesis } from './types';

function parseBound(s: string): number {
  const t = s.trim().replace('∞', 'inf');
  if (/^\+?inf(inity)?$/i.test(t)) return Infinity;
  if (/^-inf(inity)?$/i.test(t) || t === '−inf') return -Infinity;
  const n = Number(t);
  if (Number.isNaN(n)) throw new CEValidationError(`Invalid interval bound "${s}".`);
  return n;
}

/**
 * Parse one constraint written as in the course:
 * "?", "∅", a value, a group name, "[30, 40]", "[71, +∞[", "]-∞, 59]".
 */
export function parseConstraint(space: HypothesisSpace, attr: number, token: string): Constraint {
  const t = token.trim();
  const spec = space.attributes[attr];
  if (t === '?' || t === '*') return { t: 'any' };
  if (t === '∅' || t === 'Ø') return { t: 'none' };
  if (spec.kind === 'interval') {
    const m = /^[[\]]\s*([^,]+),\s*([^\]\[]+)\s*[[\]]$/.exec(t);
    if (!m) throw new CEValidationError(`"${token}" is not an interval for "${spec.name}" (expected [lo, hi]).`);
    return { t: 'int', lo: parseBound(m[1]), hi: parseBound(m[2]) };
  }
  if (spec.values.includes(t)) return { t: 'val', v: t };
  if ((spec.hierarchy ?? []).some((g) => g.name === t)) return { t: 'grp', g: t };
  throw new CEValidationError(`"${token}" is neither a value nor a group of "${spec.name}".`);
}

/** Parse ["?", "team", "?", "national", "Saturday"] or "⟨?, team, ?, national, Saturday⟩". */
export function parseHypothesis(space: HypothesisSpace, input: string | readonly string[]): Hypothesis {
  let tokens: string[];
  if (typeof input === 'string') {
    const body = input.trim().replace(/^[⟨<(]/, '').replace(/[⟩>)]$/, '');
    // an interval token is "[a, b]" / "[a, b[" / "]a, b]" and contains one comma
    const re = /\s*([[\]][^,[\]]*,[^,[\]]*[[\]]|[^,]+?)\s*(?:,|$)/g;
    tokens = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null && m[0] !== '') tokens.push(m[1]);
  } else tokens = [...input];
  if (tokens.length !== space.attributes.length) {
    throw new CEValidationError(`Expected ${space.attributes.length} constraints, got ${tokens.length}.`);
  }
  return canonicalize(
    space,
    tokens.map((tk, i) => parseConstraint(space, i, tk)),
  );
}
