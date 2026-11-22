'use client';
import { useId, type ReactNode } from 'react';
export interface ChoiceGroupProps {
  label: ReactNode;
  children: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
}
export function ChoiceGroup({
  label,
  children,
  helper,
  error,
}: ChoiceGroupProps) {
  const id = useId();
  const description =
    [helper && `${id}-help`, error && `${id}-error`]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <fieldset
      aria-describedby={description}
      aria-invalid={error ? true : undefined}
      className="min-w-0 border-0 p-0"
    >
      <legend className="mb-2 p-0 font-semibold">{label}</legend>
      <div className="grid gap-2 rounded-lg border border-border-strong p-4">
        {children}
      </div>
      {helper && (
        <p id={`${id}-help`} className="text-muted">
          {helper}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
