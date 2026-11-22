import type { AnchorHTMLAttributes } from 'react';
import { cx, focus, target } from '../atoms/styles';
export interface NavItemProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  active?: boolean;
}
export function NavItem({ active, className, ...props }: NavItemProps) {
  return (
    <a
      {...props}
      aria-current={active ? 'page' : undefined}
      className={cx(
        target,
        focus,
        'inline-flex items-center border-l-4 px-4 py-2',
        active
          ? 'border-primary font-semibold text-primary'
          : 'border-transparent text-muted',
        className,
      )}
    />
  );
}
