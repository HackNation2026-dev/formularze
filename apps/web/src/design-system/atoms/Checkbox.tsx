import type { InputHTMLAttributes, ReactNode } from 'react';
import { cx, focus, target } from './styles';
export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  label: ReactNode;
}
export function Checkbox({ label, className, ...props }: CheckboxProps) {
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
        type="checkbox"
        className={cx(
          focus,
          'size-5 accent-primary disabled:cursor-not-allowed',
        )}
      />
      <span>{label}</span>
    </label>
  );
}
