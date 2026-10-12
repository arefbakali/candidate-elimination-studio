'use client';

import * as React from 'react';
import { buildScenes } from '@/lib/presentation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CloseIcon, ExpandIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon } from '@/components/ui/icons';
import { LatticeView } from '@/components/lattice/LatticeView';
import { getLattice, useStudio } from '@/store/studio';
import { HypothesisText } from './Hypothesis';
import { PseudocodePanel } from './SimulatorPanels';

export function Presentation({ onClose }: { onClose: () => void }) {
  const dataset = useStudio((s) => s.dataset);
  const datasets = useStudio((s) => s.datasets);
  const space = useStudio((s) => s.space);
  const result = useStudio((s) => s.result);
  const setStep = useStudio((s) => s.setStep);
  const loadDataset = useStudio((s) => s.loadDataset);
  const reveal = useStudio((s) => s.reveal);
  const revealToken = useStudio((s) => s.revealToken);
  const selected = useStudio((s) => s.selectedNode);
  const select = useStudio((s) => s.selectNode);
  const [i, setI] = React.useState(0);
  const [auto, setAuto] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);

  // the guided demo starts with the course's Sport dataset
  React.useEffect(() => {
    if (useStudio.getState().dataset.id !== 'sport') loadDataset('sport');
  }, [loadDataset]);

  const scenes = React.useMemo(() => (space && result ? buildScenes(dataset, space, result) : []), [dataset, space, result]);
  const scene = scenes[Math.min(i, scenes.length - 1)];

  React.useEffect(() => {
    setI(0);
  }, [dataset]);

  React.useEffect(() => {
    if (!scene) return;
    setStep(scene.step);
    select(null);
    if (scene.reveal) {
      const t = setTimeout(reveal, 250);
      return () => clearTimeout(t);
    }
  }, [scene, setStep, reveal, select]);

  React.useEffect(() => {
    if (!auto || !scene) return;
    const t = setTimeout(() => {
      if (i < scenes.length - 1) setI(i + 1);
      else setAuto(false);
    }, scene.seconds * 1000);
    return () => clearTimeout(t);
  }, [auto, i, scene, scenes.length]);

  React.useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') setI((x) => Math.min(scenes.length - 1, x + 1));
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') setI((x) => Math.max(0, x - 1));
      else if (e.key === 'Escape' && !document.fullscreenElement) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scenes.length, onClose]);

  if (!space || !result || !scene) return null;
  const step = result.steps[scene.step];
  const lattice = getLattice(dataset, space, step, false);
  const seen = dataset.examples.slice(0, step.phase === 'result' ? step.exampleIndex + 1 : Math.max(0, step.exampleIndex));
  const total = scenes.reduce((a, s) => a + s.seconds, 0);
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div ref={rootRef} className="fixed inset-0 z-[60] flex flex-col bg-ink" role="dialog" aria-modal="true" aria-label="Presentation mode" data-testid="presentation">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
        <div className="mr-auto">
          <p className="text-sm font-semibold">Candidate Elimination — guided demonstration</p>
          <p className="text-xs text-muted">
            Scene {i + 1} of {scenes.length} · about {Math.round(total / 60)} minutes · {mmss(elapsed)} elapsed
          </p>
        </div>
        <select className="h-8 cursor-pointer rounded-md border border-line bg-panel px-2 text-xs" value={dataset.id} onChange={(e) => loadDataset(e.target.value)} aria-label="Dataset to present">
          {datasets.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <Button size="sm" variant="ghost" onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void rootRef.current?.requestFullscreen?.())}>
          <ExpandIcon size={14} /> Fullscreen
        </Button>
        <Button size="iconSm" variant="ghost" onClick={onClose} aria-label="Exit presentation">
          <CloseIcon size={14} />
        </Button>
      </header>
      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="relative min-h-[50vh] border-line lg:border-r">
          <LatticeView lattice={lattice} space={space} seen={seen} revealToken={revealToken} selected={selected} onSelect={select} />
        </div>
        <div className="thin-scroll flex min-h-0 flex-col gap-4 overflow-auto p-6">
          <div key={i} className="fade-in">
            <h2 className="text-2xl font-semibold leading-tight text-fg" data-testid="scene-title">
              {scene.title}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-fg/90">{scene.narration}</p>
          </div>
          <div className="space-y-2 rounded-xl border border-line p-3 text-xs">
            <div>
              <span className="mr-2 font-semibold text-g">G</span>
              {step.G.length ? step.G.map((h, k) => <HypothesisText key={k} h={h} attributes={dataset.attributes} className="mr-2 inline-block" />) : <span className="text-danger">∅</span>}
            </div>
            <div>
              <span className="mr-2 font-semibold text-s">S</span>
              {step.S.length ? step.S.map((h, k) => <HypothesisText key={k} h={h} attributes={dataset.attributes} className="mr-2 inline-block" />) : <span className="text-danger">∅</span>}
            </div>
          </div>
          <PseudocodePanel step={step} />
        </div>
      </div>
      <footer className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3">
        <Button size="sm" variant="secondary" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}>
          <PrevIcon size={14} /> Previous
        </Button>
        <Button size="sm" variant="primary" onClick={() => setI((x) => Math.min(scenes.length - 1, x + 1))} disabled={i === scenes.length - 1} data-testid="scene-next">
          Next <NextIcon size={14} />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAuto((a) => !a)} aria-pressed={auto}>
          {auto ? <PauseIcon size={13} /> : <PlayIcon size={13} />} {auto ? 'Pause narration' : 'Auto-advance'}
        </Button>
        <div className="ml-auto flex items-center gap-1.5" aria-label="Scenes">
          {scenes.map((s, k) => (
            <button
              key={k}
              type="button"
              onClick={() => setI(k)}
              title={s.title}
              aria-label={`Scene ${k + 1}: ${s.title}`}
              aria-current={k === i ? 'step' : undefined}
              className={cn('h-2 cursor-pointer rounded-full transition-all', k === i ? 'w-6 bg-cyan' : k < i ? 'w-2 bg-indigo' : 'w-2 bg-line-strong')}
            />
          ))}
        </div>
      </footer>
    </div>
  );
}
