import type { ReactNode } from 'react';
import { Icon, type IconName } from '../atoms/Icon';
export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: IconName;
  action?: ReactNode;
}
export function EmptyState({
  title,
  description,
  icon = 'file',
  action,
}: EmptyStateProps) {
  return (
    <div className="grid justify-items-center gap-4 rounded-lg border border-dashed border-border-strong bg-surface p-6 text-center">
      <Icon name={icon} />
      <p className="text-xl font-semibold">{title}</p>
      {description && <p className="text-muted">{description}</p>}
      {action}
    </div>
  );
}
