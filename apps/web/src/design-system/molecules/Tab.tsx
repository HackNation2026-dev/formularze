import type { ButtonHTMLAttributes } from 'react';
import { cx, focus, target } from '../atoms/styles';
export interface TabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  panelId: string;
}
// Kontener tablist odpowiada za przenoszenie fokusu strzałkami między zakładkami.
export function Tab({
  active = false,
  panelId,
  className,
  ...props
}: TabProps) {
  return (
    <button
      {...props}
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={panelId}
      tabIndex={active ? 0 : -1}
      className={cx(
        target,
        focus,
        'rounded-md border-0 border-b-2 bg-surface px-4 py-2',
        active
          ? 'border-primary text-primary font-semibold'
          : 'border-transparent text-muted',
        className,
      )}
    />
  );
}
