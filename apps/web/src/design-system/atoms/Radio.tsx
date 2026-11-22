import type { InputHTMLAttributes, ReactNode } from 'react';
import { cx, focus, target } from './styles';
export interface RadioProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  label: ReactNode;
}
export function Radio({ label, className, ...props }: RadioProps) {
  return (
    <label
      className={cx(
        target,
        'inline-flex cursor-pointer items-center gap-3',
        className,
      )}
    >
      <input
        {...props}
        type="radio"
        className={cx(
          focus,
          'size-5 accent-primary disabled:cursor-not-allowed',
        )}
      />
      <span>{label}</span>
    </label>
  );
}
