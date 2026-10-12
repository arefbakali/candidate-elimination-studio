'use client';

import * as React from 'react';
import Link from 'next/link';
import { buildLattice, candidateElimination, createSpace, formatHypothesis, formatInstance } from '@/lib/ce';
import { SPORT } from '@/lib/datasets';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { LatticeView } from '@/components/lattice/LatticeView';
import { Logo } from '@/components/studio/Studio';

const space = createSpace(SPORT.attributes);
const run = candidateElimination(space, SPORT.examples);
// states shown in the hero: after examples 1, 2, 3, 4, 5 (all computed by the engine)
const frames = run.history.slice(1).map((b, i) => ({ b, i, lattice: buildLattice(space, b, { maxNodes: 40 }) }));

export function Landing() {
  const [f, setF] = React.useState(frames.length - 1);
  const [paused, setPaused] = React.useState(false);
  React.useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setF((x) => (x + 1) % frames.length), 3200);
    return () => clearInterval(t);
  }, [paused]);
  const frame = frames[f];
  const ex = SPORT.examples[frame.i];

  return (
    <div className="min-h-dvh bg-ink text-fg">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Logo />
          Candidate Elimination Studio
        </div>
        <Link href="/studio" className="text-xs text-muted hover:text-fg">
          Open the studio
        </Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-16 pt-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:pt-14">
          <div>
            <h1 className="text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[3.4rem]">Every hypothesis consistent with the data, drawn exactly.</h1>
            <div className="mt-8">
              <Link href="/studio" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'shadow-[0_10px_40px_-10px_var(--indigo)]')} data-testid="launch">
                Launch Candidate Elimination Studio
              </Link>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted">Sport, slide 77</dt>
                <dd className="mt-1 font-mono text-fg">6 hypotheses</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Birds, slide 81</dt>
                <dd className="mt-1 font-mono text-fg">intervals</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Verified against</dt>
                <dd className="mt-1 font-mono text-fg">brute force</dd>
              </div>
            </dl>
          </div>

          <figure className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            <div className="h-[420px] overflow-hidden rounded-2xl border border-line sm:h-[460px]">
              <LatticeView lattice={frame.lattice} space={space} seen={[]} selected={null} onSelect={() => undefined} compact />
            </div>
            <figcaption className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span className="flex gap-1" aria-label="Examples">
                {frames.map((fr, k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setF(k)}
                    aria-label={`Show the version space after example ${k + 1}`}
                    className={cn('h-1.5 cursor-pointer rounded-full transition-all', k === f ? 'w-5 bg-cyan' : 'w-1.5 bg-line-strong')}
                  />
                ))}
              </span>
              <span>
                Sport, after x{frame.i + 1} <span className={ex.label ? 'text-s' : 'text-danger'}>{ex.label ? '(+)' : '(−)'}</span> <span className="font-mono">{formatInstance(ex.values)}</span>
              </span>
            </figcaption>
          </figure>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h2 className="text-xl font-semibold">What happens to the Sport data</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">The same five examples as the course. Each line below is read from the engine&apos;s output.</p>
            <ol className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-5">
              {run.history.slice(1).map((b, k) => {
                const e = SPORT.examples[k];
                return (
                  <li key={k} className="bg-panel p-4">
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-xs text-faint">x{k + 1}</span>
                      <span className={cn('text-xs font-medium', e.label ? 'text-s' : 'text-danger')}>{e.label ? 'positive' : 'negative'}</span>
                    </div>
                    <p className="mt-1 text-sm text-fg">{e.values[0]}</p>
                    <div className="mt-3 space-y-1 font-mono text-[11px] leading-snug">
                      {b.G.map((h) => (
                        <p key={formatHypothesis(h)} className="text-g">
                          {formatHypothesis(h)}
                        </p>
                      ))}
                      {b.S.map((h) => (
                        <p key={formatHypothesis(h)} className="text-s">
                          {formatHypothesis(h)}
                        </p>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="mt-4 text-xs text-faint">Violet: G, the most general consistent hypotheses. Emerald: S, the most specific ones.</p>
          </div>
        </section>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-6 py-6 text-xs text-faint">
          <span>Course: N. Ben Amor, Machine Learning Theory, Chapter 2 — Learning by exploration.</span>
          <span>T. M. Mitchell, Machine Learning (1997), chapter 2.</span>
        </div>
      </footer>
    </div>
  );
}
