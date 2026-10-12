'use client';

import * as React from 'react';
import Link from 'next/link';
import { useStudio, getLattice, getVS, type View } from '@/store/studio';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { AlertIcon, ChartIcon, CloseIcon, FileIcon, LatticeIcon, MenuIcon, MoonIcon, PresentIcon, SunIcon, TableIcon, TargetIcon } from '@/components/ui/icons';
import { LatticeView } from '@/components/lattice/LatticeView';
import { PlaybackControls, usePlayLoop } from './Playback';
import { BoundaryTracker, PseudocodePanel, StepPanel, TrainingTable } from './SimulatorPanels';
import { HistoryTimeline } from './HistoryTimeline';
import { DatasetEditor } from './DatasetEditor';
import { ClassifyPanel } from './ClassifyPanel';
import { AnalyticsPanel } from './AnalyticsPanel';
import { ExportPanel } from './ExportPanel';
import { Presentation } from './Presentation';

const NAV: { view: View; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { view: 'simulator', label: 'Simulator', icon: LatticeIcon },
  { view: 'dataset', label: 'Dataset', icon: TableIcon },
  { view: 'classify', label: 'Classify', icon: TargetIcon },
  { view: 'analytics', label: 'Analytics', icon: ChartIcon },
  { view: 'export', label: 'Export', icon: FileIcon },
];

function useKeyboard() {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      const s = useStudio.getState();
      if (s.presenting || s.view !== 'simulator') return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        s.setPlaying(false);
        s.next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        s.setPlaying(false);
        s.prev();
      } else if (e.key === ' ' && !t.closest('button')) {
        e.preventDefault();
        s.setPlaying(!s.playing);
      } else if (e.key === 'Home') {
        e.preventDefault();
        s.first();
      } else if (e.key === 'End') {
        e.preventDefault();
        s.last();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function Studio() {
  usePlayLoop();
  useKeyboard();
  const view = useStudio((s) => s.view);
  const setView = useStudio((s) => s.setView);
  const theme = useStudio((s) => s.theme);
  const toggleTheme = useStudio((s) => s.toggleTheme);
  const datasets = useStudio((s) => s.datasets);
  const dataset = useStudio((s) => s.dataset);
  const loadDataset = useStudio((s) => s.loadDataset);
  const presenting = useStudio((s) => s.presenting);
  const setPresenting = useStudio((s) => s.setPresenting);
  const error = useStudio((s) => s.error);
  const [navOpen, setNavOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('ce-theme');
      if (saved === 'light' && useStudio.getState().theme !== 'light') useStudio.getState().toggleTheme();
    } catch {
      /* storage unavailable */
    }
  }, []);

  return (
    <div className="flex min-h-dvh bg-ink text-fg">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[232px] flex-col border-r border-line bg-panel transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0',
          navOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-4 pb-3 pt-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
            <Logo />
            <span>
              Candidate Elimination
              <span className="block text-[11px] font-normal text-muted">Studio</span>
            </span>
          </Link>
          <Button size="iconSm" variant="ghost" className="lg:hidden" onClick={() => setNavOpen(false)} aria-label="Close menu">
            <CloseIcon size={14} />
          </Button>
        </div>
        <nav className="space-y-0.5 px-2" aria-label="Studio sections">
          {NAV.map(({ view: v, label, icon: Icon }) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setView(v);
                setNavOpen(false);
              }}
              aria-current={view === v ? 'page' : undefined}
              className={cn('flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors', view === v ? 'bg-indigo/15 text-fg' : 'text-muted hover:bg-panel-2 hover:text-fg')}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-5 px-4 text-[11px] font-medium text-faint">Datasets</div>
        <div className="thin-scroll mt-1 min-h-0 flex-1 space-y-0.5 overflow-auto px-2" role="listbox" aria-label="Datasets">
          {datasets.map((d) => (
            <button
              key={d.id}
              type="button"
              role="option"
              aria-selected={dataset.id === d.id}
              onClick={() => {
                loadDataset(d.id);
                setNavOpen(false);
              }}
              className={cn('w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left transition-colors', dataset.id === d.id ? 'bg-panel-2 text-fg' : 'text-muted hover:bg-panel-2/60 hover:text-fg')}
            >
              <span className="block text-[13px]">{d.name}</span>
              <span className="block truncate text-[11px] text-faint">{d.source}</span>
            </button>
          ))}
        </div>
        <div className="space-y-2 border-t border-line p-3">
          <Button
            variant="primary"
            className="w-full"
            onClick={() => {
              setPresenting(true);
              setNavOpen(false);
            }}
          >
            <PresentIcon size={16} /> Present to the class
          </Button>
          <Button variant="ghost" size="sm" className="w-full" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? <SunIcon size={14} /> : <MoonIcon size={14} />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </Button>
        </div>
      </aside>
      {navOpen ? <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setNavOpen(false)} /> : null}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-ink/90 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="icon" variant="ghost" className="lg:hidden" onClick={() => setNavOpen(true)} aria-label="Open menu">
              <MenuIcon />
            </Button>
            <div className="min-w-0 mr-auto">
              <h1 className="truncate text-base font-semibold" data-testid="dataset-title">
                {dataset.name}
              </h1>
              <p className="truncate text-xs text-muted">{dataset.description}</p>
            </div>
          </div>
          {view === 'simulator' ? (
            <div className="mt-3">
              <PlaybackControls />
            </div>
          ) : null}
        </header>
        {error ? (
          <div className="m-4 flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert" data-testid="studio-error">
            <AlertIcon size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">The algorithm cannot run on this dataset yet.</p>
              <p className="text-danger/90">{error}</p>
              {view !== 'dataset' ? (
                <button type="button" className="mt-1 cursor-pointer underline" onClick={() => setView('dataset')}>
                  Open the dataset editor to fix it
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 p-4">
          {view === 'simulator' ? <SimulatorView /> : null}
          {view === 'dataset' ? <DatasetEditor /> : null}
          {view === 'classify' ? <ClassifyPanel /> : null}
          {view === 'analytics' ? <AnalyticsPanel /> : null}
          {view === 'export' ? <ExportPanel /> : null}
        </div>
      </main>
      {presenting ? <Presentation onClose={() => setPresenting(false)} /> : null}
    </div>
  );
}

function SimulatorView() {
  const dataset = useStudio((s) => s.dataset);
  const space = useStudio((s) => s.space);
  const result = useStudio((s) => s.result);
  const stepIdx = useStudio((s) => s.step);
  const showRemoved = useStudio((s) => s.showRemoved);
  const setShowRemoved = useStudio((s) => s.setShowRemoved);
  const selected = useStudio((s) => s.selectedNode);
  const select = useStudio((s) => s.selectNode);
  const revealToken = useStudio((s) => s.revealToken);
  const reveal = useStudio((s) => s.reveal);
  const last = useStudio((s) => s.last);
  if (!space || !result) return null;
  const step = result.steps[Math.min(stepIdx, result.steps.length - 1)];
  const lattice = getLattice(dataset, space, step, showRemoved);
  const seenCount = step.phase === 'result' ? step.exampleIndex + 1 : Math.max(0, step.exampleIndex);
  const seen = dataset.examples.slice(0, seenCount);
  const vs = getVS(dataset, space, step.S, step.G);
  const isFinal = step.index === result.steps.length - 1;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)_minmax(300px,360px)]">
      <div className="flex min-w-0 flex-col gap-4 xl:h-[calc(100dvh-170px)]">
        <div className="max-h-[300px] min-h-[160px] shrink-0 xl:max-h-[38%]">
          <TrainingTable dataset={dataset} result={result} step={step} />
        </div>
        <div className="min-h-[260px] flex-1">
          <StepPanel dataset={dataset} result={result} step={step} />
        </div>
      </div>
      <div className="order-first flex min-w-0 flex-col gap-4 xl:order-none xl:h-[calc(100dvh-170px)]">
        <section className="relative h-[62vh] min-h-[420px] overflow-hidden rounded-xl border border-line xl:h-auto xl:flex-1" aria-label="Version space lattice">
          <LatticeView
            lattice={lattice}
            space={space}
            seen={seen}
            revealToken={revealToken}
            selected={selected}
            onSelect={select}
            caption={
              <span className="pointer-events-auto flex w-fit flex-wrap items-center gap-1.5">
                <Badge tone={vs.status === 'empty' ? 'neg' : 'cyan'} data-testid="vs-size">
                  |VS| = {vs.status === 'complete' ? vs.count.toLocaleString() : vs.status === 'empty' ? 0 : vs.status === 'infinite' ? '∞' : `> ${vs.count.toLocaleString()}`}
                </Badge>
                <button type="button" onClick={() => setShowRemoved(!showRemoved)} className="cursor-pointer rounded-md border border-line bg-panel/90 px-1.5 py-0.5 text-[11px] text-muted hover:text-fg" aria-pressed={showRemoved}>
                  {showRemoved ? 'hide' : 'show'} removed
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!isFinal) last();
                    setTimeout(reveal, isFinal ? 0 : 700);
                  }}
                  className="cursor-pointer rounded-md border border-purple/50 bg-purple/15 px-1.5 py-0.5 text-[11px] text-fg hover:bg-purple/25"
                  data-testid="reveal-button"
                >
                  Final diamond reveal
                </button>
              </span>
            }
          />
        </section>
        <div className="shrink-0">
          <HistoryTimeline dataset={dataset} result={result} step={step} />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-4 xl:h-[calc(100dvh-170px)]">
        <div className="min-h-[220px] flex-1">
          <BoundaryTracker dataset={dataset} result={result} step={step} />
        </div>
        <div className="shrink-0">
          <PseudocodePanel step={step} />
        </div>
      </div>
    </div>
  );
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--g)" />
          <stop offset="1" stopColor="var(--s)" />
        </linearGradient>
      </defs>
      <path d="M16 3 29 16 16 29 3 16Z" fill="none" stroke="url(#logo-g)" strokeWidth="2" />
      <path d="M16 3v26M3 16h26" stroke="var(--line-strong)" strokeWidth="1" />
      <circle cx="16" cy="3.5" r="2.6" fill="var(--g)" />
      <circle cx="16" cy="28.5" r="2.6" fill="var(--s)" />
    </svg>
  );
}
