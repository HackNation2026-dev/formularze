import type { TextareaHTMLAttributes } from 'react';
import { control, cx, fieldState, type FieldState } from './styles';
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  state?: FieldState;
}
export function Textarea({
  state = 'default',
  className,
  readOnly,
  ...props
}: TextareaProps) {
  return (
    <textarea
      rows={4}
      {...props}
      readOnly={readOnly || state === 'readOnly' || state === 'externalSystem'}
      aria-invalid={props['aria-invalid'] ?? (state === 'error' || undefined)}
      data-state={state}
      className={cx(control, fieldState[state], className)}
    />
  );
}
