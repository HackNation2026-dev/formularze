import type { InputHTMLAttributes } from 'react';
import { control, cx, fieldState, type FieldState } from './styles';
export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  state?: FieldState;
}
export function TextInput({
  state = 'default',
  className,
  readOnly,
  ...props
}: TextInputProps) {
  return (
    <input
      {...props}
      readOnly={readOnly || state === 'readOnly' || state === 'externalSystem'}
      aria-invalid={props['aria-invalid'] ?? (state === 'error' || undefined)}
      data-state={state}
      className={cx(control, fieldState[state], className)}
    />
  );
}
