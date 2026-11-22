import type { HTMLAttributes } from 'react';
export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  value?: number;
  label: string;
}
export function ProgressBar({ value, label, ...props }: ProgressBarProps) {
  const bounded =
    value === undefined ? undefined : Math.min(100, Math.max(0, value));
  return (
    <div
      {...props}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={bounded}
      className="h-2 w-full overflow-hidden rounded-sm bg-border"
    >
      <div
        className={
          bounded === undefined
            ? 'h-full w-1/2 animate-pulse bg-primary motion-reduce:animate-none'
            : 'h-full bg-primary'
        }
        style={bounded === undefined ? undefined : { width: `${bounded}%` }}
      />
    </div>
  );
}
