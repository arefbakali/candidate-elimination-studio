'use client';

/**
 * Simulation state. The whole run is computed once per dataset change; the UI
 * only moves an index through the immutable trace, so Previous/Next and
 * jump-to-step are always exact.
 */
import { create } from 'zustand';
import {
  buildLattice,
  candidateElimination,
  createSpace,
  enumerateVersionSpace,
  hKey,
  type CEResult,
  type Dataset,
  type HypothesisSpace,
  type Lattice,
  type TraceStep,
  type VSEnumeration,
} from '@/lib/ce';
import { BUILTIN_DATASETS, emptyCustomDataset } from '@/lib/datasets';
import { validateDataset, type ValidationReport } from '@/lib/io/schema';

export type View = 'simulator' | 'dataset' | 'classify' | 'analytics' | 'export';
export type Mode = 'example' | 'detailed';

interface Computation {
  space: HypothesisSpace | null;
  result: CEResult | null;
  error: string | null;
  validation: ValidationReport;
}

export interface StudioState extends Computation {
  datasets: Dataset[];
  dataset: Dataset;
  step: number;
  mode: Mode;
  playing: boolean;
  speed: number;
  view: View;
  explain: 'simple' | 'formal';
  theme: 'dark' | 'light';
  selectedNode: string | null;
  showRemoved: boolean;
  presenting: boolean;
  revealToken: number;
  compareWith: number | null;

  loadDataset: (id: string) => void;
  setDataset: (ds: Dataset, opts?: { keepStep?: boolean }) => void;
  addDataset: (ds: Dataset) => void;
  setStep: (i: number) => void;
  next: () => boolean;
  prev: () => void;
  first: () => void;
  last: () => void;
  setMode: (m: Mode) => void;
  setPlaying: (p: boolean) => void;
  setSpeed: (s: number) => void;
  setView: (v: View) => void;
  setExplain: (e: 'simple' | 'formal') => void;
  toggleTheme: () => void;
  selectNode: (id: string | null) => void;
  setShowRemoved: (v: boolean) => void;
  setPresenting: (v: boolean) => void;
  reveal: () => void;
  setCompareWith: (i: number | null) => void;
}

export function compute(ds: Dataset): Computation {
  const validation = validateDataset(ds);
  if (validation.errors.length > 0) return { space: null, result: null, error: validation.errors[0], validation };
  try {
    const space = createSpace(ds.attributes);
    const result = candidateElimination(space, ds.examples);
    return { space, result, error: null, validation };
  } catch (e) {
    return { space: null, result: null, error: e instanceof Error ? e.message : String(e), validation };
  }
}

/** Indices of the steps visible in the current playback mode. */
export function visibleSteps(result: CEResult | null, mode: Mode): number[] {
  if (!result) return [0];
  if (mode === 'detailed') return result.steps.map((s) => s.index);
  return result.steps.filter((s) => s.phase === 'init' || s.phase === 'result').map((s) => s.index);
}

const initial = BUILTIN_DATASETS[0];

export const useStudio = create<StudioState>((set, get) => ({
  datasets: [...BUILTIN_DATASETS, emptyCustomDataset()],
  dataset: initial,
  ...compute(initial),
  step: 0,
  mode: 'detailed',
  playing: false,
  speed: 1,
  view: 'simulator',
  explain: 'simple',
  theme: 'dark',
  selectedNode: null,
  showRemoved: true,
  presenting: false,
  revealToken: 0,
  compareWith: null,

  loadDataset: (id) => {
    const ds = get().datasets.find((d) => d.id === id);
    if (ds) set({ dataset: ds, ...compute(ds), step: 0, playing: false, selectedNode: null, compareWith: null });
  },
  setDataset: (ds, opts) => {
    const c = compute(ds);
    const max = c.result ? c.result.steps.length - 1 : 0;
    set((s) => ({
      dataset: ds,
      ...c,
      datasets: s.datasets.map((d) => (d.id === ds.id ? ds : d)),
      step: opts?.keepStep ? Math.min(s.step, max) : 0,
      playing: false,
      selectedNode: null,
      compareWith: null,
    }));
  },
  addDataset: (ds) => {
    set((s) => ({ datasets: [...s.datasets.filter((d) => d.id !== ds.id), ds] }));
    get().loadDataset(ds.id);
  },
  setStep: (i) => {
    const r = get().result;
    const max = r ? r.steps.length - 1 : 0;
    set({ step: Math.max(0, Math.min(max, i)) });
  },
  next: () => {
    const { result, mode, step } = get();
    const nxt = visibleSteps(result, mode).find((i) => i > step);
    if (nxt === undefined) return false;
    set({ step: nxt });
    return true;
  },
  prev: () => {
    const { result, mode, step } = get();
    const vis = visibleSteps(result, mode).filter((i) => i < step);
    if (vis.length) set({ step: vis[vis.length - 1] });
  },
  first: () => set({ step: 0, playing: false }),
  last: () => {
    const r = get().result;
    set({ step: r ? r.steps.length - 1 : 0, playing: false });
  },
  setMode: (m) => {
    const { result, step } = get();
    if (m === 'example' && result) {
      // snap to the result of the current example so the displayed state is a real boundary state
      const s = result.steps[step];
      const target = s.exampleIndex < 0 ? 0 : result.steps.find((x) => x.exampleIndex === s.exampleIndex && x.phase === 'result')!.index;
      set({ mode: m, step: target });
    } else set({ mode: m });
  },
  setPlaying: (p) => set({ playing: p }),
  setSpeed: (s) => set({ speed: s }),
  setView: (v) => set({ view: v }),
  setExplain: (e) => set({ explain: e }),
  toggleTheme: () => {
    const theme = get().theme === 'dark' ? 'light' : 'dark';
    if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('ce-theme', theme);
    } catch {
      /* storage unavailable */
    }
    set({ theme });
  },
  selectNode: (id) => set({ selectedNode: id }),
  setShowRemoved: (v) => set({ showRemoved: v }),
  setPresenting: (v) => set({ presenting: v, playing: false }),
  reveal: () => set((s) => ({ revealToken: s.revealToken + 1 })),
  setCompareWith: (i) => set({ compareWith: i }),
}));

// ───────────── derived, memoised data ─────────────

const latticeCache = new Map<string, Lattice>();
const vsCache = new Map<string, VSEnumeration>();

export function stepKey(ds: Dataset, step: TraceStep, extra = '') {
  return `${ds.id}|${ds.examples.length}|${step.index}|${step.S.map(hKey).join(',')}|${step.G.map(hKey).join(',')}|${extra}`;
}

export function getLattice(ds: Dataset, space: HypothesisSpace, step: TraceStep, showRemoved: boolean): Lattice {
  const removed = showRemoved ? step.removed : [];
  const key = `${stepKey(ds, step)}|${removed.map(hKey).join(',')}|${JSON.stringify(ds.attributes)}`;
  let l = latticeCache.get(key);
  if (!l) {
    l = buildLattice(space, { S: step.S, G: step.G }, { samples: ds.sampleHypotheses, removed, maxNodes: 120 });
    if (latticeCache.size > 400) latticeCache.clear();
    latticeCache.set(key, l);
  }
  return l;
}

export function getVS(ds: Dataset, space: HypothesisSpace, S: TraceStep['S'], G: TraceStep['G']): VSEnumeration {
  const key = `${ds.id}|${JSON.stringify(ds.attributes)}|${S.map(hKey).join(',')}|${G.map(hKey).join(',')}`;
  let v = vsCache.get(key);
  if (!v) {
    v = enumerateVersionSpace(space, { S, G }, 20000);
    if (vsCache.size > 400) vsCache.clear();
    vsCache.set(key, v);
  }
  return v;
}
