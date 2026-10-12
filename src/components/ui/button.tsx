import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 cursor-pointer select-none',
  {
    variants: {
      variant: {
        primary: 'bg-indigo text-white hover:bg-indigo/85 shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset]',
        secondary: 'bg-panel-2 text-fg border border-line hover:border-line-strong hover:bg-panel-2/70',
        ghost: 'text-muted hover:text-fg hover:bg-panel-2',
        outline: 'border border-line text-fg hover:bg-panel-2',
        danger: 'text-danger hover:bg-danger/10',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-3.5',
        lg: 'h-12 px-6 text-base',
        icon: 'h-9 w-9',
        iconSm: 'h-7 w-7',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
