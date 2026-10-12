/**
 * Exports. Every export is computed from the same CEResult the studio displays.
 */
import { CEResult, PSEUDOCODE } from '../ce/algorithm';
import { formatHypothesis, formatInstance } from '../ce/format';
import { hKey } from '../ce/hypothesis';
import { HypothesisSpace } from '../ce/space';
import { Dataset, Hypothesis } from '../ce/types';
import { enumerateVersionSpace, Lattice } from '../ce/versionSpace';
import { toCsv } from '../io/csv';
import { serializeDataset } from '../io/schema';
import { Block, buildPdf } from './pdf';

const fh = (hs: readonly Hypothesis[]) => hs.map(formatHypothesis);

function vsSize(space: HypothesisSpace, r: CEResult, i: number) {
  const vs = enumerateVersionSpace(space, r.history[i], 20000);
  return vs.status === 'complete' ? String(vs.count) : vs.status === 'empty' ? '0' : vs.status === 'infinite' ? 'infinite' : `>${20000}`;
}

export function resultJson(ds: Dataset, space: HypothesisSpace, r: CEResult) {
  const vs = enumerateVersionSpace(space, r.final, 20000);
  return {
    generator: 'Candidate Elimination Studio',
    generatedAt: new Date().toISOString(),
    dataset: serializeDataset(ds),
    final: {
      S: fh(r.final.S),
      G: fh(r.final.G),
      collapsed: r.collapsed,
      collapseAtExample: r.collapseAt === null ? null : r.collapseAt + 1,
      versionSpace: { status: vs.status, size: vs.status === 'complete' ? vs.count : null, hypotheses: fh(vs.hypotheses) },
    },
    history: historyRows(space, r),
    stats: r.stats,
    totalMs: Number(r.totalMs.toFixed(3)),
    steps: r.steps.map((s) => ({
      index: s.index,
      example: s.exampleIndex + 1,
      phase: s.phase,
      lines: s.lines,
      title: s.title,
      explanation: s.simple,
      formal: s.formal,
      S: fh(s.S),
      G: fh(s.G),
      added: fh(s.added),
      removed: fh(s.removed),
    })),
  };
}

export function historyRows(space: HypothesisSpace, r: CEResult) {
  return r.history.map((b, i) => ({
    step: i,
    example: i === 0 ? null : formatInstance(r.details[i - 1].example.values),
    label: i === 0 ? null : r.details[i - 1].example.label ? '+' : '-',
    S: fh(b.S),
    G: fh(b.G),
    sizeS: b.S.length,
    sizeG: b.G.length,
    versionSpace: vsSize(space, r, i),
  }));
}

export function historyCsv(space: HypothesisSpace, r: CEResult): string {
  const rows = historyRows(space, r);
  return toCsv([
    ['step', 'example', 'label', 'S', 'G', '|S|', '|G|', '|VS|'],
    ...rows.map((x) => [x.step, x.example, x.label, x.S.join(' ; '), x.G.join(' ; '), x.sizeS, x.sizeG, x.versionSpace]),
  ]);
}

export function reportBlocks(ds: Dataset, space: HypothesisSpace, r: CEResult): Block[] {
  const b: Block[] = [];
  b.push({ kind: 'title', text: `Candidate Elimination — ${ds.name}` });
  b.push({ kind: 'p', text: `${ds.source ?? ''}${ds.source ? '. ' : ''}${ds.description ?? ''}` });
  b.push({ kind: 'p', text: `Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC by Candidate Elimination Studio.` });
  b.push({ kind: 'rule' });
  b.push({ kind: 'h1', text: '1. Hypothesis language' });
  ds.attributes.forEach((a) => {
    if (a.kind === 'categorical') {
      const h = a.hierarchy?.length ? `; hierarchy: ${a.hierarchy.map((g) => `${g.name} = {${g.members.join(', ')}}`).join(', ')}` : '';
      b.push({ kind: 'p', text: `${a.name} (categorical): {${a.values.join(', ')}}${h}` });
    } else {
      b.push({ kind: 'p', text: `${a.name} (interval): values on the grid ${a.min} + k·${a.step} within [${a.min}, ${a.max === Infinity ? '+∞[' : a.max + ']'}; constraints are intervals [lo, hi].` });
    }
  });
  b.push({ kind: 'p', text: 'A hypothesis is a conjunction of one constraint per attribute: ? accepts any value, ∅ accepts none. h1 ⪯ h2 iff cover(h1) ⊆ cover(h2).' });
  b.push({ kind: 'h1', text: '2. Training examples' });
  ds.examples.forEach((e, i) => b.push({ kind: 'mono', text: `x${i + 1}  ${e.label ? '+' : '-'}  ${formatInstance(e.values)}` }));
  b.push({ kind: 'h1', text: '3. Algorithm (course pseudocode)' });
  PSEUDOCODE.forEach((l) => b.push({ kind: 'mono', text: `${String(l.n).padStart(2)}  ${'  '.repeat(l.indent)}${l.text}` }));
  b.push({ kind: 'h1', text: '4. Step-by-step execution' });
  let currentEx = -2;
  for (const s of r.steps) {
    if (s.exampleIndex !== currentEx) {
      currentEx = s.exampleIndex;
      b.push({ kind: 'h2', text: s.exampleIndex < 0 ? 'Initialisation' : `Example ${s.exampleIndex + 1} (${r.details[s.exampleIndex].example.label ? 'positive' : 'negative'})  ${formatInstance(r.details[s.exampleIndex].example.values)}` });
    }
    if (s.phase === 'present') continue;
    b.push({ kind: 'p', text: `${s.title}${s.lines.length ? ` [line ${s.lines.join(', ')}]` : ''}: ${s.simple}` });
    if (s.candidates?.length && s.phase === 'filter-candidates') {
      for (const c of s.candidates) b.push({ kind: 'mono', text: `   ${c.kept ? 'kept    ' : 'rejected'}  ${formatHypothesis(c.h)}` });
    }
    if (s.phase === 'result') {
      b.push({ kind: 'mono', text: `   S${s.exampleIndex + 1} = { ${fh(s.S).join(', ')} }` });
      b.push({ kind: 'mono', text: `   G${s.exampleIndex + 1} = { ${fh(s.G).join(', ')} }` });
    }
  }
  b.push({ kind: 'h1', text: '5. Result' });
  const vs = enumerateVersionSpace(space, r.final, 20000);
  b.push({ kind: 'mono', text: `S = { ${fh(r.final.S).join(', ')} }` });
  b.push({ kind: 'mono', text: `G = { ${fh(r.final.G).join(', ')} }` });
  if (r.collapsed) b.push({ kind: 'p', text: `The version space became empty at example ${(r.collapseAt ?? 0) + 1}: the data contain an error or the target concept is not in H.` });
  else if (vs.status === 'complete') {
    b.push({ kind: 'p', text: `The version space contains exactly ${vs.count} hypotheses:` });
    vs.hypotheses
      .slice()
      .sort((a, c) => hKey(a).localeCompare(hKey(c)))
      .slice(0, 200)
      .forEach((h) => b.push({ kind: 'mono', text: `   ${formatHypothesis(h)}` }));
  } else b.push({ kind: 'p', text: `The version space is ${vs.status === 'infinite' ? 'infinite (unbounded intervals)' : 'too large to list'}; it is exactly the set of hypotheses h with s ⪯ h ⪯ g for some s ∈ S and g ∈ G.` });
  b.push({ kind: 'h1', text: '6. Boundary history' });
  historyRows(space, r).forEach((x) => b.push({ kind: 'mono', text: `${x.step}: |S|=${x.sizeS} |G|=${x.sizeG} |VS|=${x.versionSpace}` }));
  return b;
}

export function reportPdf(ds: Dataset, space: HypothesisSpace, r: CEResult): Uint8Array<ArrayBuffer> {
  return buildPdf(reportBlocks(ds, space, r), { title: `Candidate Elimination — ${ds.name}` });
}

// ───────────────────────────── SVG ─────────────────────────────

export interface NodeBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Standalone SVG of a lattice, built from the same layout the studio displays. */
export function latticeSvg(lat: Lattice, boxes: Map<string, NodeBox>, opts: { dark: boolean; title?: string }): string {
  const pal = opts.dark
    ? { bg: '#070b1a', fg: '#e2e8f0', muted: '#94a3b8', edge: '#6366f1', node: '#111833', G: '#a78bfa', S: '#34d399', member: '#818cf8', sample: '#22d3ee', ghost: '#475569', removed: '#f87171' }
    : { bg: '#ffffff', fg: '#0f172a', muted: '#475569', edge: '#6366f1', node: '#f8fafc', G: '#7c3aed', S: '#059669', member: '#4f46e5', sample: '#0891b2', ghost: '#94a3b8', removed: '#dc2626' };
  const all = [...boxes.values()];
  if (all.length === 0) return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"/>`;
  const minX = Math.min(...all.map((b) => b.x)) - 40;
  const minY = Math.min(...all.map((b) => b.y)) - 60;
  const maxX = Math.max(...all.map((b) => b.x + b.w)) + 40;
  const maxY = Math.max(...all.map((b) => b.y + b.h)) + 40;
  const W = maxX - minX;
  const H = maxY - minY;
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${minX} ${minY} ${W} ${H}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">`);
  parts.push(`<rect x="${minX}" y="${minY}" width="${W}" height="${H}" fill="${pal.bg}"/>`);
  if (opts.title) parts.push(`<text x="${minX + 20}" y="${minY + 28}" fill="${pal.fg}" font-size="15" font-family="system-ui, sans-serif" font-weight="600">${esc(opts.title)}</text>`);
  for (const e of lat.edges) {
    const s = boxes.get(e.source);
    const t = boxes.get(e.target);
    if (!s || !t) continue;
    const x1 = s.x + s.w / 2;
    const y1 = s.y;
    const x2 = t.x + t.w / 2;
    const y2 = t.y + t.h;
    const my = (y1 + y2) / 2;
    const dash = e.kind === 'cover' ? '' : e.kind === 'order' ? ' stroke-dasharray="6 5"' : ' stroke-dasharray="2 5"';
    parts.push(`<path d="M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}" fill="none" stroke="${e.kind === 'outside' ? pal.ghost : pal.edge}" stroke-width="1.6"${dash} marker-end="url(#arrow)"/>`);
  }
  parts.splice(2, 0, `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${pal.edge}"/></marker></defs>`);
  for (const n of lat.nodes) {
    const b = boxes.get(n.id);
    if (!b) continue;
    const role = n.roles.includes('G') ? 'G' : n.roles.includes('S') ? 'S' : n.roles.includes('sample') ? 'sample' : n.roles.includes('removed') ? 'removed' : n.inVS ? 'member' : 'ghost';
    const color = pal[role as keyof typeof pal];
    const label = n.roles.includes('top') && !n.inVS ? '⊤' : n.roles.includes('bottom') && !n.inVS ? '⊥' : formatHypothesis(n.h);
    const tag = role === 'G' ? 'G' : role === 'S' ? 'S' : role === 'sample' ? n.label ?? 'sample' : role === 'removed' ? 'removed' : '';
    parts.push(
      `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="10" fill="${pal.node}" stroke="${color}" stroke-width="${role === 'G' || role === 'S' ? 2.2 : 1.3}"${role === 'ghost' || role === 'removed' ? ' stroke-dasharray="4 3"' : ''}/>`,
    );
    parts.push(`<text x="${b.x + b.w / 2}" y="${b.y + b.h / 2 + (tag ? 7 : 4)}" fill="${pal.fg}" font-size="12" text-anchor="middle">${esc(label)}</text>`);
    if (tag) parts.push(`<text x="${b.x + b.w / 2}" y="${b.y + 14}" fill="${color}" font-size="9" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="700" letter-spacing="1">${esc(tag.toUpperCase())}</text>`);
  }
  parts.push('</svg>');
  return parts.join('\n');
}
