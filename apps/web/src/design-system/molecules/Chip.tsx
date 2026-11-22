import type { ReactNode } from 'react';
import { Badge } from '../atoms/Badge';
import { IconButton } from '../atoms/IconButton';
export interface ChipProps {
  children: ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
}
export function Chip({ children, onRemove, removeLabel }: ChipProps) {
  return (
    <Badge>
      {children}
      {onRemove && removeLabel && (
        <IconButton
          variant="ghost"
          icon="close"
          label={removeLabel}
          onClick={onRemove}
        />
      )}
    </Badge>
  );
}
