import type { HTMLAttributes, ReactNode } from 'react';
import { Icon } from '../atoms/Icon';
import { cx, tones, type Tone } from '../atoms/styles';
export interface CalloutProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'title'
> {
  tone?: Tone;
  title?: ReactNode;
}
export function Callout({
  tone = 'info',
  title,
  children,
  className,
  ...props
}: CalloutProps) {
  return (
    <div
      {...props}
      className={cx(
        'flex items-start gap-3 rounded-lg border bg-surface p-4',
        tones[tone],
        className,
      )}
    >
      <Icon
        name={tone === 'neutral' ? 'info' : tone === 'danger' ? 'error' : tone}
      />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
