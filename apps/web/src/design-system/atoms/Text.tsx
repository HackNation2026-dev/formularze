import type { HTMLAttributes } from 'react';
import { cx } from './styles';
export interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: 'p' | 'span' | 'h1' | 'h2' | 'h3';
  variant?: 'body' | 'heading' | 'caption' | 'code';
  muted?: boolean;
}
export function Text({
  as: Tag = 'p',
  variant = 'body',
  muted,
  className,
  ...props
}: TextProps) {
  return (
    <Tag
      {...props}
      className={cx(
        {
          body: 'text-base',
          heading: 'text-2xl font-semibold',
          caption: 'text-sm',
          code: 'font-mono text-sm',
        }[variant],
        muted ? 'text-muted' : 'text-text',
        className,
      )}
    />
  );
}
