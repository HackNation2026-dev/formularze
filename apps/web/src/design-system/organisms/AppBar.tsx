import type { ReactNode } from 'react';
import { Text } from '../atoms/Text';
export interface AppBarProps {
  title: string;
  status?: ReactNode;
  controls?: ReactNode;
}
export function AppBar({ title, status, controls }: AppBarProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface p-4">
      <div className="grid gap-2">
        <Text as="h1" variant="heading">
          {title}
        </Text>
        {status}
      </div>
      <div className="flex flex-wrap gap-3">{controls}</div>
    </header>
  );
}
