'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/primitives';
import { LastIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon, ResetIcon } from '@/components/ui/icons';
import { useStudio, visibleSteps } from '@/store/studio';

const SPEEDS = [0.5, 1, 2, 4];

/** Advances the simulation while `playing` is true. */
export function usePlayLoop() {
  const playing = useStudio((s) => s.playing);
  const speed = useStudio((s) => s.speed);
  const mode = useStudio((s) => s.mode);
  React.useEffect(() => {
    if (!playing) return;
    const base = mode === 'example' ? 1800 : 1100;
    const id = setInterval(() => {
      const st = useStudio.getState();
      const moved = st.next();
      if (!moved) {
        st.setPlaying(false);
        const r = st.result;
        if (r && st.step === r.steps.length - 1) st.reveal();
      }
    }, base / speed);
    return () => clearInterval(id);
  }, [playing, speed, mode]);
}

export function PlaybackControls() {
  const s = useStudio();
  const vis = visibleSteps(s.result, s.mode);
  const pos = Math.max(0, vis.findIndex((i) => i >= s.step));
  const atEnd = s.result ? s.step >= s.result.steps.length - 1 : true;
  const total = s.result ? s.result.steps.length : 1;
  const started = s.step > 0;

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="playback">
      <div className="flex items-center gap-1 rounded-xl border border-line bg-panel p-1">
        <Button size="iconSm" variant="ghost" onClick={s.first} disabled={!started} aria-label="Reset to the initial state" title="Reset (Home)">
          <ResetIcon size={15} />
        </Button>
        <Button size="iconSm" variant="ghost" onClick={s.prev} disabled={!started} aria-label="Previous step" title="Previous (←)">
          <PrevIcon size={16} />
        </Button>
        <Button
          size="sm"
          variant="primary"
          className="min-w-[88px]"
          disabled={!s.result}
          onClick={() => {
            if (s.playing) s.setPlaying(false);
            else {
              if (atEnd) s.first();
              s.setPlaying(true);
            }
          }}
          aria-label={s.playing ? 'Pause' : started && !atEnd ? 'Play' : 'Start'}
          title="Play / pause (Space)"
        >
          {s.playing ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
          {s.playing ? 'Pause' : started && !atEnd ? 'Play' : 'Start'}
        </Button>
        <Button size="iconSm" variant="ghost" onClick={() => s.next()} disabled={atEnd} aria-label="Next step" title="Next (→)">
          <NextIcon size={16} />
        </Button>
        <Button size="iconSm" variant="ghost" onClick={s.last} disabled={atEnd} aria-label="Last step" title="Last step (End)">
          <LastIcon size={15} />
        </Button>
      </div>
      <Segmented
        label="Playback mode"
        value={s.mode}
        onChange={s.setMode}
        options={[
          { value: 'example', label: 'Example mode', title: 'One training example per step' },
          { value: 'detailed', label: 'Detailed mode', title: 'Every internal operation of the algorithm' },
        ]}
      />
      <label className="flex items-center gap-1.5 text-xs text-muted">
        Speed
        <select
          className="h-8 cursor-pointer rounded-lg border border-line bg-panel px-2 text-xs text-fg"
          value={s.speed}
          onChange={(e) => s.setSpeed(Number(e.target.value))}
          aria-label="Playback speed"
        >
          {SPEEDS.map((v) => (
            <option key={v} value={v}>
              {v}×
            </option>
          ))}
        </select>
      </label>
      <div className="flex min-w-[220px] flex-1 items-center gap-2">
        <input
          type="range"
          min={0}
          max={total - 1}
          value={s.step}
          onChange={(e) => {
            s.setPlaying(false);
            s.setStep(Number(e.target.value));
          }}
          className="h-1.5 flex-1 cursor-pointer accent-[var(--indigo)]"
          aria-label="Jump to step"
          data-testid="scrubber"
        />
        <span className={cn('w-[86px] shrink-0 text-right font-mono text-[11px] text-muted')} data-testid="step-counter">
          {s.mode === 'example' ? `${pos} / ${vis.length - 1}` : `${s.step} / ${total - 1}`}
        </span>
      </div>
    </div>
  );
}
