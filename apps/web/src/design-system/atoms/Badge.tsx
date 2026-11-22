import type { HTMLAttributes } from 'react';
import { badgeBase, cx, tones, type Tone } from './styles';
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}
export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={cx(badgeBase, 'rounded-full', tones[tone], className)}
    />
  );
}
