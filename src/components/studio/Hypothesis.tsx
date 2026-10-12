import * as React from 'react';
import { formatConstraint, isBottom, type AttributeSpec, type Hypothesis } from '@/lib/ce';
import { cn } from '@/lib/utils';

/** Renders ⟨c1, c2, …⟩ with "?" de-emphasised and attribute names as tooltips. */
export function HypothesisText({
  h,
  attributes,
  className,
  highlight,
}: {
  h: Hypothesis;
  attributes?: readonly AttributeSpec[];
  className?: string;
  /** attribute indices to emphasise */
  highlight?: number[];
}) {
  if (isBottom(h)) {
    return <span className={cn('font-mono', className)}>⟨{h.map(() => '∅').join(', ')}⟩</span>;
  }
  return (
    <span className={cn('font-mono', className)}>
      ⟨
      {h.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 ? ', ' : ''}
          <span
            title={attributes?.[i]?.name}
            className={cn(c.t === 'any' ? 'text-faint' : 'text-fg', highlight?.includes(i) && 'rounded bg-amber/20 px-0.5 text-amber')}
          >
            {formatConstraint(c)}
          </span>
        </React.Fragment>
      ))}
      ⟩
    </span>
  );
}
