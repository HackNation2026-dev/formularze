import type { ReactNode } from 'react';
import { badgeBase, cx, tones } from '../atoms/styles';
import { IconButton } from '../atoms/IconButton';
export interface ChipProps {
  children: ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
}
export function Chip({ children, onRemove, removeLabel }: ChipProps) {
  return (
    <span className={cx(badgeBase, 'rounded-md', tones.neutral)}>
      {children}
      {onRemove && removeLabel && (
        <IconButton
          variant="ghost"
          icon="close"
          label={removeLabel}
          onClick={onRemove}
        />
      )}
    </span>
  );
}
