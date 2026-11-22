'use client';
import { cloneElement, useId, type ReactElement, type ReactNode } from 'react';
import type { FieldState } from '../atoms/styles';
export interface FormFieldProps {
  id?: string;
  label: ReactNode;
  required?: boolean;
  helper?: ReactNode;
  error?: ReactNode;
  state?: FieldState;
  children: ReactElement<{
    id?: string;
    required?: boolean;
    state?: FieldState;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
  }>;
}
export function FormField({
  id,
  label,
  required,
  helper,
  error,
  state = 'default',
  children,
}: FormFieldProps) {
  const generated = useId();
  const fieldId = id ?? children.props.id ?? generated;
  const description =
    [
      children.props['aria-describedby'],
      helper && `${fieldId}-help`,
      error && `${fieldId}-error`,
    ]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <div className="grid min-w-0 gap-2" data-state={error ? 'error' : state}>
      <label htmlFor={fieldId} className="font-semibold">
        {label}
        {required && (
          <span aria-hidden="true" className="text-danger">
            {' '}
            *
          </span>
        )}
      </label>
      {cloneElement(children, {
        id: fieldId,
        required: required ?? children.props.required,
        state: error ? 'error' : state,
        'aria-describedby': description,
        'aria-invalid': error ? true : children.props['aria-invalid'],
      })}
      {helper && (
        <p id={`${fieldId}-help`} className="text-sm text-muted">
          {helper}
        </p>
      )}
      {error && (
        <p id={`${fieldId}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
