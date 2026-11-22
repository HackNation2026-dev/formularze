import type { ReactNode } from 'react';
import { Callout } from './Callout';
import { IconButton } from '../atoms/IconButton';
export interface ToastProps {
  tone?: 'success' | 'error' | 'info';
  children: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
}
export function Toast({
  tone = 'info',
  children,
  onDismiss,
  dismissLabel,
}: ToastProps) {
  return (
    <Callout
      tone={tone === 'error' ? 'danger' : tone}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <div className="flex items-center justify-between gap-4">
        <div>{children}</div>
        {onDismiss && dismissLabel && (
          <IconButton
            variant="ghost"
            icon="close"
            label={dismissLabel}
            onClick={onDismiss}
          />
        )}
      </div>
    </Callout>
  );
}
