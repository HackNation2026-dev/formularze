import type { ReactNode } from 'react';
export interface KeyValueProps {
  label: ReactNode;
  value: ReactNode;
}
export function KeyValue({ label, value }: KeyValueProps) {
  return (
    <dl className="grid gap-1">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="break-words font-semibold">{value}</dd>
    </dl>
  );
}
