import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn('rounded-xl border border-line bg-panel', className)} {...props} />;
}

export function PanelHeader({ title, hint, children, className }: { title: React.ReactNode; hint?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <header className={cn('flex items-center justify-between gap-3 border-b border-line px-4 py-2.5', className)}>
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold leading-snug text-fg">{title}</h2>
        {hint ? <p className="truncate text-xs text-muted">{hint}</p> : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-1">{children}</div> : null}
    </header>
  );
}

const badgeVariants = cva('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-none', {
  variants: {
    tone: {
      neutral: 'bg-panel-2 text-muted border border-line',
      s: 'bg-s/12 text-s border border-s/30',
      g: 'bg-g/12 text-g border border-g/30',
      pos: 'bg-s/12 text-s border border-s/30',
      neg: 'bg-danger/12 text-danger border border-danger/30',
      cyan: 'bg-cyan/12 text-cyan border border-cyan/30',
      indigo: 'bg-indigo/15 text-indigo border border-indigo/30',
      amber: 'bg-amber/12 text-amber border border-amber/30',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: React.ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line bg-panel-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            'cursor-pointer rounded-md font-medium transition-colors',
            size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs',
            value === o.value ? 'bg-indigo text-white' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-line bg-panel-2 px-1 font-mono text-[10px] text-muted">{children}</kbd>;
}
