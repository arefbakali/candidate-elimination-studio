/**
 * Lattice layout. ELK's layered algorithm (direction UP, edges from the more
 * specific to the more general hypothesis) places general hypotheses above
 * specific ones, like the course diagrams. A deterministic rank-based layout is
 * used as an immediate placeholder and as a fallback.
 */
import { formatHypothesis } from './ce/format';
import type { Lattice, LatticeNode } from './ce/versionSpace';
import type { NodeBox } from './export/report';

export const NODE_H = 48;

export function nodeLabel(n: LatticeNode): string {
  if (!n.inVS && n.roles.includes('top')) return '⊤';
  if (!n.inVS && n.roles.includes('bottom')) return '⊥';
  return formatHypothesis(n.h);
}

export function nodeWidth(n: LatticeNode): number {
  const label = nodeLabel(n);
  if (label.length <= 2) return 64;
  return Math.min(420, Math.max(110, Math.round(label.length * 7.25 + 36)));
}

/** Layers by generality rank (number of constrained attributes); ⊤ on top, ⊥ at the bottom. */
export function fallbackLayout(lat: Lattice): Map<string, NodeBox> {
  const boxes = new Map<string, NodeBox>();
  const main = lat.nodes.filter((n) => !n.roles.includes('removed'));
  const ranks = [...new Set(main.map((n) => n.rank))].sort((a, b) => a - b);
  const rowGap = 96;
  ranks.forEach((r, row) => {
    const layer = main.filter((n) => n.rank === r).sort((a, b) => a.id.localeCompare(b.id));
    const widths = layer.map(nodeWidth);
    const total = widths.reduce((a, w) => a + w, 0) + (layer.length - 1) * 28;
    let x = -total / 2;
    layer.forEach((n, i) => {
      boxes.set(n.id, { id: n.id, x, y: row * rowGap, w: widths[i], h: NODE_H });
      x += widths[i] + 28;
    });
  });
  placeRemoved(lat, boxes);
  return boxes;
}

function placeRemoved(lat: Lattice, boxes: Map<string, NodeBox>) {
  const removed = lat.nodes.filter((n) => n.roles.includes('removed'));
  if (removed.length === 0) return;
  const all = [...boxes.values()];
  const right = all.length ? Math.max(...all.map((b) => b.x + b.w)) + 90 : 0;
  const top = all.length ? Math.min(...all.map((b) => b.y)) : 0;
  removed.forEach((n, i) => boxes.set(n.id, { id: n.id, x: right, y: top + i * (NODE_H + 18), w: nodeWidth(n), h: NODE_H }));
}

interface ElkNodeOut {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface ElkLike {
  layout(graph: unknown): Promise<{ children?: ElkNodeOut[] }>;
}

let elkPromise: Promise<ElkLike> | null = null;

async function getElk(): Promise<ElkLike> {
  if (!elkPromise) {
    elkPromise = import('elkjs/lib/elk.bundled.js').then((m) => {
      const Ctor = (m as unknown as { default: new () => ElkLike }).default;
      return new Ctor();
    });
  }
  return elkPromise;
}

export async function elkLayout(lat: Lattice): Promise<Map<string, NodeBox>> {
  const main = lat.nodes.filter((n) => !n.roles.includes('removed'));
  const ids = new Set(main.map((n) => n.id));
  const elk = await getElk();
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'UP',
      'elk.layered.spacing.nodeNodeBetweenLayers': '62',
      'elk.spacing.nodeNode': '30',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.separateConnectedComponents': 'false',
    },
    children: main
      .slice()
      .sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id))
      .map((n) => ({ id: n.id, width: nodeWidth(n), height: NODE_H })),
    edges: lat.edges.filter((e) => ids.has(e.source) && ids.has(e.target)).map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  };
  const out = await elk.layout(graph);
  const boxes = new Map<string, NodeBox>();
  for (const c of out.children ?? []) boxes.set(c.id, { id: c.id, x: c.x ?? 0, y: c.y ?? 0, w: c.width ?? 100, h: c.height ?? NODE_H });
  // center horizontally around 0 for smooth transitions between layouts
  const all = [...boxes.values()];
  if (all.length) {
    const cx = (Math.min(...all.map((b) => b.x)) + Math.max(...all.map((b) => b.x + b.w))) / 2;
    for (const b of all) b.x -= cx;
  }
  placeRemoved(lat, boxes);
  return boxes;
}
