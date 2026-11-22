import type { ReactNode } from 'react';
import { Button } from '../atoms/Button';
import { Text } from '../atoms/Text';
export interface SidePanelProps {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}
export function SidePanel({
  title,
  closeLabel,
  onClose,
  children,
}: SidePanelProps) {
  return (
    <aside
      aria-label={title}
      className="hidden min-w-0 content-start gap-4 rounded-lg border border-border bg-surface p-4 md:grid"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Text as="h2" variant="heading">
          {title}
        </Text>
        <Button variant="ghost" onClick={onClose}>
          {closeLabel}
        </Button>
      </div>
      {children}
    </aside>
  );
}
