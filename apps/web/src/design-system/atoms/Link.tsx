import type { AnchorHTMLAttributes } from 'react';
import { cx, focus, target } from './styles';
export function Link({
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      {...props}
      className={cx(
        target,
        focus,
        'inline-flex items-center text-primary underline underline-offset-4',
        className,
      )}
    />
  );
}
