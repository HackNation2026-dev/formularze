import type { ReactNode } from 'react';
import type messages from '../../../../../messages/pl/design-system.json';
export type Copy = typeof messages;
export type ExampleProps = { t: Copy };
export function Example({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 content-start gap-3 rounded-md border border-border p-4">
      <p className="text-sm text-muted">{label}</p>
      {children}
    </div>
  );
}
export const states = [
  'default',
  'focus',
  'error',
  'readOnly',
  'externalSystem',
  'disabled',
] as const;
export const tones = [
  'success',
  'warning',
  'danger',
  'info',
  'neutral',
] as const;
export function stateLabel(t: Copy, state: (typeof states)[number]) {
  return state === 'readOnly'
    ? t.readonly
    : state === 'error'
      ? t.errorState
      : t[state];
}
