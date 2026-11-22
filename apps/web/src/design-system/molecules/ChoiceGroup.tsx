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
      className="grid gap-2 rounded-md border border-border-strong p-4"
    >
      <legend className="px-2 font-semibold">{label}</legend>
      {children}
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
