import type { SelectHTMLAttributes } from 'react';
import { control, cx, fieldState, type FieldState } from './styles';
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  state?: FieldState;
}
export function Select({
  state = 'default',
  className,
  ...props
}: SelectProps) {
  return (
    <select
      {...props}
      disabled={
        props.disabled || state === 'readOnly' || state === 'externalSystem'
      }
      aria-invalid={props['aria-invalid'] ?? (state === 'error' || undefined)}
      data-state={state}
      className={cx(control, fieldState[state], className)}
    />
  );
}
