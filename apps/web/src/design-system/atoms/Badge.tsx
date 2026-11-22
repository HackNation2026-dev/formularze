import type { HTMLAttributes } from 'react';
import { cx, tones, type Tone } from './styles';
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}
export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={cx(
        'inline-flex items-center gap-2 rounded-sm border bg-surface px-2 py-1 text-sm font-semibold',
        tones[tone],
        className,
      )}
    />
  );
}
