'use client';

import * as React from 'react';
import { covers, describeHypothesis, formatConstraint, formatHypothesis, type Example, type HypothesisSpace, type Lattice, type LatticeNode } from '@/lib/ce';
import type { NodeBox } from '@/lib/export/report';
import { elkLayout, fallbackLayout, nodeLabel } from '@/lib/layout';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CloseIcon, ExpandIcon, FitIcon, ZoomInIcon, ZoomOutIcon } from '@/components/ui/icons';

interface Props {
  lattice: Lattice;
  space: HypothesisSpace;
  /** examples processed so far, for the consistency check of a selected node */
  seen: readonly Example[];
  revealToken?: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
  /** compact = no controls/legend (landing page, presentation thumbnails) */
  compact?: boolean;
  caption?: React.ReactNode;
}

type Role = 'G' | 'S' | 'GS' | 'member' | 'sample' | 'top' | 'bottom' | 'removed';

function roleOf(n: LatticeNode): Role {
  if (n.roles.includes('removed')) return 'removed';
  if (n.roles.includes('G') && n.roles.includes('S')) return 'GS';
  if (n.roles.includes('G')) return 'G';
  if (n.roles.includes('S')) return 'S';
  if (n.roles.includes('sample')) return 'sample';
  if (!n.inVS && n.roles.includes('top')) return 'top';
  if (!n.inVS && n.roles.includes('bottom')) return 'bottom';
  return 'member';
}

const roleStyle: Record<Role, string> = {
  G: 'border-g bg-[color-mix(in_oklab,var(--g)_14%,var(--panel))] shadow-[0_0_24px_-6px_var(--g)]',
  S: 'border-s bg-[color-mix(in_oklab,var(--s)_14%,var(--panel))] shadow-[0_0_24px_-6px_var(--s)]',
  GS: 'border-cyan bg-[linear-gradient(90deg,color-mix(in_oklab,var(--s)_18%,var(--panel)),color-mix(in_oklab,var(--g)_18%,var(--panel)))] shadow-[0_0_26px_-6px_var(--cyan)]',
  member: 'border-line-strong bg-panel',
  sample: 'border-cyan/70 bg-[color-mix(in_oklab,var(--cyan)_10%,var(--panel))]',
  top: 'border-dashed border-faint/60 bg-transparent text-muted',
  bottom: 'border-dashed border-faint/60 bg-transparent text-muted',
  removed: 'border-dashed border-danger/60 bg-[color-mix(in_oklab,var(--danger)_8%,var(--panel))] opacity-75',
};

const tagText: Partial<Record<Role, string>> = { G: 'G boundary', S: 'S boundary', GS: 'S = G', removed: 'removed' };

function edgePath(s: NodeBox, t: NodeBox) {
  const x1 = s.x + s.w / 2;
  const y1 = s.y;
  const x2 = t.x + t.w / 2;
  const y2 = t.y + t.h;
  const my = (y1 + y2) / 2;
  return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
}

export function LatticeView({ lattice, space, seen, revealToken = 0, selected, onSelect, className, compact, caption }: Props) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = React.useState<Map<string, NodeBox>>(() => fallbackLayout(lattice));
  const [view, setView] = React.useState({ x: 0, y: 0, k: 1 });
  const [animate, setAnimate] = React.useState(true);
  const [revealing, setRevealing] = React.useState(false);
  const [labels, setLabels] = React.useState(true);
  const [hover, setHover] = React.useState<string | null>(null);
  const prevIds = React.useRef<Set<string>>(new Set());
  const [enterIds, setEnterIds] = React.useState<Set<string>>(new Set());
  const drag = React.useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  // layout: immediate rank-based placement, then ELK
  React.useEffect(() => {
    let alive = true;
    const ids = new Set(lattice.nodes.map((n) => n.id));
    setEnterIds(new Set([...ids].filter((id) => !prevIds.current.has(id))));
    prevIds.current = ids;
    elkLayout(lattice)
      .then((b) => alive && setBoxes(b))
      .catch(() => alive && setBoxes(fallbackLayout(lattice)));
    return () => {
      alive = false;
    };
  }, [lattice]);

  const bounds = React.useMemo(() => {
    const all = [...boxes.values()].filter((b) => lattice.nodes.some((n) => n.id === b.id));
    if (all.length === 0) return { minX: -100, minY: -50, maxX: 100, maxY: 50 };
    return {
      minX: Math.min(...all.map((b) => b.x)),
      minY: Math.min(...all.map((b) => b.y)),
      maxX: Math.max(...all.map((b) => b.x + b.w)),
      maxY: Math.max(...all.map((b) => b.y + b.h)),
    };
  }, [boxes, lattice]);

  const fit = React.useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const W = el.clientWidth;
    const H = el.clientHeight;
    const pad = compact ? 16 : 48;
    const bw = bounds.maxX - bounds.minX;
    const bh = bounds.maxY - bounds.minY;
    const k = Math.min(1.25, (W - 2 * pad) / Math.max(bw, 1), (H - 2 * pad - (compact ? 0 : 110)) / Math.max(bh, 1));
    const kk = Math.max(0.15, k);
    setAnimate(true);
    setView({ k: kk, x: W / 2 - ((bounds.minX + bounds.maxX) / 2) * kk, y: H / 2 + (compact ? 0 : 34) - ((bounds.minY + bounds.maxY) / 2) * kk });
  }, [bounds, compact]);

  React.useEffect(() => {
    fit();
  }, [fit]);

  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  // wheel zoom around the cursor (non-passive listener so the page does not scroll)
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el || compact) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      setAnimate(false);
      setView((v) => {
        const k = Math.max(0.15, Math.min(3, v.k * Math.exp(-e.deltaY * 0.0015)));
        return { k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [compact]);

  React.useEffect(() => {
    if (!revealToken) return;
    setRevealing(true);
    const t = setTimeout(() => setRevealing(false), 4200);
    return () => clearTimeout(t);
  }, [revealToken]);

  // path highlighting for the selected node
  const related = React.useMemo(() => {
    if (!selected) return null;
    const up = new Set<string>([selected]);
    const down = new Set<string>([selected]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of lattice.edges) {
        if (up.has(e.source) && !up.has(e.target)) {
          up.add(e.target);
          changed = true;
        }
        if (down.has(e.target) && !down.has(e.source)) {
          down.add(e.source);
          changed = true;
        }
      }
    }
    return { up, down };
  }, [selected, lattice]);

  const zoomBy = (f: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    setAnimate(true);
    setView((v) => {
      const k = Math.max(0.15, Math.min(3, v.k * f));
      return { k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k };
    });
  };

  const fullscreen = () => {
    const el = wrapRef.current?.parentElement;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  const maxY = bounds.maxY;
  const selectedNode = lattice.nodes.find((n) => n.id === selected) ?? null;
  const showEdgeLabels = labels && !compact && lattice.edges.filter((e) => e.kind !== 'outside').length <= 40;
  const vsCount = lattice.vs.status === 'complete' ? lattice.vs.count : null;

  return (
    <div className={cn('relative flex h-full min-h-0 flex-col overflow-hidden bg-ink [&:fullscreen]:bg-ink', className)}>
      <div
        ref={wrapRef}
        data-testid="lattice-canvas"
        className={cn('graph-paper relative min-h-0 flex-1 touch-none overflow-hidden', !compact && 'cursor-grab active:cursor-grabbing')}
        onPointerDown={(e) => {
          if (compact || (e.target as HTMLElement).closest('[data-node], button, a, input, select, aside')) return;
          drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          setAnimate(false);
          setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y }));
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (d && Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) < 4) onSelect(null);
        }}
      >
        {lattice.vs.status === 'empty' ? (
          <div className="absolute inset-0 grid place-items-center p-6 text-center" data-testid="vs-empty">
            <div className="max-w-sm">
              <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full border border-dashed border-danger/60 font-mono text-2xl text-danger">∅</div>
              <p className="text-sm font-semibold text-fg">The version space is empty</p>
              <p className="mt-1 text-xs text-muted">No conjunctive hypothesis is consistent with every example. The data contain an error, or the target concept is outside H (slide 84).</p>
            </div>
          </div>
        ) : null}
        <div
          className={cn('absolute left-0 top-0 origin-top-left', revealing && 'reveal')}
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
            transition: animate ? 'transform 650ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
          }}
        >
          {revealing ? (
            <div
              className="reveal-halo pointer-events-none absolute rounded-[50%]"
              style={{
                left: bounds.minX - 120,
                top: bounds.minY - 120,
                width: bounds.maxX - bounds.minX + 240,
                height: bounds.maxY - bounds.minY + 240,
                background: 'radial-gradient(closest-side, color-mix(in oklab, var(--purple) 35%, transparent), color-mix(in oklab, var(--cyan) 12%, transparent) 60%, transparent)',
              }}
            />
          ) : null}
          <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" aria-hidden="true">
            <defs>
              <marker id="lat-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="var(--indigo)" />
              </marker>
              <marker id="lat-arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="var(--cyan)" />
              </marker>
            </defs>
            {lattice.edges.map((e) => {
              const s = boxes.get(e.source);
              const t = boxes.get(e.target);
              if (!s || !t) return null;
              const hotUp = related?.up.has(e.source) && related.up.has(e.target);
              const hotDown = related?.down.has(e.source) && related.down.has(e.target);
              const hot = hotUp || hotDown;
              const dim = related && !hot;
              const delay = revealing ? ((maxY - s.y) / 110) * 260 : 0;
              return (
                <path
                  key={e.id}
                  d={edgePath(s, t)}
                  className={cn('ledge', hot && 'ledge-flow')}
                  data-edge-kind={e.kind}
                  fill="none"
                  stroke={hotUp ? 'var(--g)' : hotDown ? 'var(--s)' : e.kind === 'outside' ? 'var(--faint)' : 'var(--indigo)'}
                  strokeOpacity={dim ? 0.15 : e.kind === 'outside' ? 0.5 : 0.85}
                  strokeWidth={hot ? 2.4 : e.kind === 'cover' ? 1.6 : 1.3}
                  strokeDasharray={hot ? undefined : e.kind === 'order' ? '6 5' : e.kind === 'outside' ? '2 5' : undefined}
                  markerEnd={hot ? 'url(#lat-arrow-hot)' : e.kind === 'outside' ? undefined : 'url(#lat-arrow)'}
                  style={{ ['--reveal-delay' as string]: `${delay}ms` }}
                />
              );
            })}
            {showEdgeLabels
              ? lattice.edges
                  .filter((e) => e.kind === 'cover' && e.changed.length === 1)
                  .map((e) => {
                    const s = boxes.get(e.source);
                    const t = boxes.get(e.target);
                    const sn = lattice.nodes.find((n) => n.id === e.source);
                    const tn = lattice.nodes.find((n) => n.id === e.target);
                    if (!s || !t || !sn || !tn) return null;
                    const i = e.changed[0];
                    const x = (s.x + s.w / 2 + t.x + t.w / 2) / 2;
                    const y = (s.y + t.y + t.h) / 2;
                    const dim = related && !(related.up.has(e.source) && related.up.has(e.target)) && !(related.down.has(e.source) && related.down.has(e.target));
                    return (
                      <text key={`l-${e.id}`} x={x} y={y} textAnchor="middle" className="fill-muted font-mono" fontSize={10} opacity={dim ? 0.2 : 0.9} style={{ paintOrder: 'stroke', stroke: 'var(--ink)', strokeWidth: 4 }}>
                        {`${formatConstraint(sn.h[i])} → ${formatConstraint(tn.h[i])}`}
                      </text>
                    );
                  })
              : null}
          </svg>
          {lattice.nodes.map((n) => {
            const b = boxes.get(n.id);
            if (!b) return null;
            const role = roleOf(n);
            const isSel = selected === n.id;
            const inPath = related ? related.up.has(n.id) || related.down.has(n.id) : false;
            const dim = related && !inPath;
            const delay = revealing ? ((maxY - b.y) / 110) * 260 : 0;
            const label = nodeLabel(n);
            const tag = role === 'sample' ? `sample ${n.label ?? ''}` : tagText[role];
            return (
              <button
                key={n.id}
                type="button"
                data-node={n.id}
                data-role={role}
                aria-label={`${tag ? tag + ': ' : ''}${label}`}
                aria-pressed={isSel}
                title={describeHypothesis(space, n.h)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(isSel ? null : n.id);
                }}
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover((h) => (h === n.id ? null : h))}
                className={cn(
                  'lnode absolute left-0 top-0 flex cursor-pointer flex-col items-center justify-center rounded-[10px] border px-3 text-center',
                  roleStyle[role],
                  enterIds.has(n.id) && !revealing && 'lnode-enter',
                  isSel && 'ring-2 ring-cyan ring-offset-2 ring-offset-ink',
                  dim && 'opacity-25',
                )}
                style={{ transform: `translate(${b.x}px, ${b.y}px)`, width: b.w, height: b.h, ['--reveal-delay' as string]: `${delay}ms` }}
              >
                {tag ? (
                  <span className={cn('text-[9px] font-semibold leading-none tracking-wide', role === 'G' && 'text-g', role === 'S' && 'text-s', role === 'GS' && 'text-cyan', role === 'sample' && 'text-cyan', role === 'removed' && 'text-danger')}>{tag}</span>
                ) : null}
                <span className={cn('font-mono text-[12px] leading-tight text-fg', role === 'removed' && 'line-through decoration-danger/70', (role === 'top' || role === 'bottom') && 'text-lg text-muted', tag && 'mt-1')}>{label}</span>
              </button>
            );
          })}
        </div>
        {!compact ? (
          <div className="pointer-events-none absolute left-3 top-3 flex max-w-[70%] flex-col gap-1">
            <span className="pointer-events-auto w-fit rounded-md border border-line bg-panel/90 px-2 py-1 text-[11px] text-muted backdrop-blur" data-testid="lattice-mode">
              {lattice.mode === 'complete' ? (
                <>
                  Complete version space · <b className="text-fg">{vsCount}</b> hypothes{vsCount === 1 ? 'is' : 'es'} · Hasse diagram
                </>
              ) : lattice.vs.status === 'empty' ? (
                <>Version space: ∅</>
              ) : (
                <>
                  Boundary view · {lattice.vs.status === 'infinite' ? 'infinite version space' : lattice.vs.status === 'complete' ? `${lattice.vs.count} hypotheses` : `more than ${lattice.vs.count.toLocaleString()} hypotheses`}
                </>
              )}
            </span>
            {lattice.note && lattice.vs.status !== 'empty' ? <span className="w-fit rounded-md bg-panel/80 px-2 py-1 text-[11px] text-faint backdrop-blur">{lattice.note}</span> : null}
            {caption}
          </div>
        ) : null}
        {!compact ? (
          <div className="absolute right-3 top-3 flex gap-1 rounded-lg border border-line bg-panel/90 p-1 backdrop-blur">
            <Button size="iconSm" variant="ghost" onClick={() => zoomBy(1.25)} aria-label="Zoom in" title="Zoom in">
              <ZoomInIcon />
            </Button>
            <Button size="iconSm" variant="ghost" onClick={() => zoomBy(0.8)} aria-label="Zoom out" title="Zoom out">
              <ZoomOutIcon />
            </Button>
            <Button size="iconSm" variant="ghost" onClick={fit} aria-label="Fit to view" title="Fit to view">
              <FitIcon />
            </Button>
            <Button size="iconSm" variant="ghost" onClick={fullscreen} aria-label="Fullscreen" title="Fullscreen">
              <ExpandIcon />
            </Button>
            <button type="button" onClick={() => setLabels((v) => !v)} className={cn('cursor-pointer rounded-md px-2 text-[11px]', labels ? 'text-cyan' : 'text-muted')} aria-pressed={labels} title="Show what changes along each edge">
              edge labels
            </button>
          </div>
        ) : null}
        {!compact ? (
          <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-x-3 gap-y-1 rounded-lg border border-line bg-panel/90 px-2.5 py-1.5 text-[11px] text-muted backdrop-blur">
            <Legend swatch="border-g bg-g/20" text="G (most general)" />
            <Legend swatch="border-s bg-s/20" text="S (most specific)" />
            <Legend swatch="border-line-strong bg-panel" text="inside VS" />
            <Legend swatch="border-dashed border-faint" text="⊤ / ⊥ outside VS" />
            {lattice.nodes.some((n) => n.roles.includes('removed')) ? <Legend swatch="border-dashed border-danger bg-danger/10" text="removed this step" /> : null}
            <span className="flex items-center gap-1">
              <svg width="22" height="6" aria-hidden="true">
                <line x1="0" y1="3" x2="22" y2="3" stroke="var(--indigo)" strokeWidth="1.6" strokeDasharray={lattice.mode === 'complete' ? undefined : '5 4'} />
              </svg>
              {lattice.mode === 'complete' ? 'immediate generalisation' : 'more general (intermediates hidden)'}
            </span>
          </div>
        ) : null}
        {revealing && !compact ? (
          <div className="fade-in pointer-events-none absolute inset-x-0 bottom-14 text-center">
            <span className="rounded-full border border-purple/50 bg-panel/90 px-4 py-1.5 text-sm text-fg shadow-[0_0_40px_-8px_var(--purple)] backdrop-blur">
              {vsCount !== null ? `Final version space: ${vsCount} hypothes${vsCount === 1 ? 'is' : 'es'} consistent with every example` : 'Final version space'}
            </span>
          </div>
        ) : null}
      </div>
      {selectedNode && !compact ? <NodeDetails node={selectedNode} space={space} seen={seen} lattice={lattice} onClose={() => onSelect(null)} /> : null}
      {hover && !selectedNode && !compact ? <HoverHint node={lattice.nodes.find((n) => n.id === hover)} space={space} /> : null}
    </div>
  );
}

function Legend({ swatch, text }: { swatch: string; text: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn('inline-block h-2.5 w-3.5 rounded-[3px] border', swatch)} />
      {text}
    </span>
  );
}

function HoverHint({ node, space }: { node?: LatticeNode; space: HypothesisSpace }) {
  if (!node) return null;
  return (
    <div className="pointer-events-none absolute bottom-12 right-3 max-w-xs rounded-lg border border-line bg-panel/95 px-3 py-2 text-xs text-muted backdrop-blur">
      <div className="font-mono text-fg">{formatHypothesis(node.h)}</div>
      <div className="mt-0.5">{describeHypothesis(space, node.h)}</div>
    </div>
  );
}

function NodeDetails({ node, space, seen, lattice, onClose }: { node: LatticeNode; space: HypothesisSpace; seen: readonly Example[]; lattice: Lattice; onClose: () => void }) {
  const above = lattice.edges.filter((e) => e.source === node.id && e.kind !== 'outside').length;
  const below = lattice.edges.filter((e) => e.target === node.id && e.kind !== 'outside').length;
  return (
    <aside className="fade-in absolute bottom-3 right-3 z-10 w-[min(360px,calc(100%-24px))] rounded-xl border border-line bg-panel/95 p-3 text-xs shadow-2xl backdrop-blur" data-testid="node-details">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="break-words font-mono text-[13px] text-fg">{formatHypothesis(node.h)}</div>
          <div className="mt-1 text-muted">{describeHypothesis(space, node.h)}</div>
        </div>
        <Button size="iconSm" variant="ghost" onClick={onClose} aria-label="Close details">
          <CloseIcon size={14} />
        </Button>
      </div>
      <p className="mt-2 text-muted">
        {node.inVS ? 'Inside the version space' : node.roles.includes('removed') ? 'Removed at this step' : 'Outside the version space'}
        {node.inVS ? ` · ${above} immediate generalisation${above === 1 ? '' : 's'}, ${below} specialisation${below === 1 ? '' : 's'} drawn` : ''}. Paths to more general hypotheses glow violet, to more specific ones emerald.
      </p>
      {seen.length > 0 ? (
        <table className="mt-2 w-full">
          <tbody>
            {seen.map((ex, i) => {
              const c = covers(space, node.h, ex.values);
              const ok = c === ex.label;
              return (
                <tr key={`${ex.id}-${i}`} className="border-t border-line/60">
                  <td className="py-0.5 pr-2 text-faint">x{i + 1}</td>
                  <td className={cn('pr-2', ex.label ? 'text-s' : 'text-danger')}>{ex.label ? '+' : '−'}</td>
                  <td className="pr-2 text-muted">{c ? 'covered' : 'rejected'}</td>
                  <td className={cn('text-right font-medium', ok ? 'text-s' : 'text-danger')}>{ok ? 'consistent' : 'inconsistent'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </aside>
  );
}
