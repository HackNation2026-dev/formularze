import type { ButtonHTMLAttributes } from 'react';
import { Spinner } from './Spinner';
import { cx, focus, target } from './styles';
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonState = 'default' | 'hover' | 'focus';
const variants = {
  primary: 'bg-primary text-primary-foreground border-primary',
  secondary: 'bg-surface text-primary border-primary',
  ghost: 'bg-transparent text-primary border-transparent',
  danger: 'bg-danger text-surface border-danger',
};
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  state?: ButtonState;
}
export function Button({
  variant = 'primary',
  loading = false,
  state = 'default',
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-state={state}
      className={cx(
        target,
        focus,
        'inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 font-semibold hover:underline disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        state === 'hover' && 'underline',
        state === 'focus' && 'outline-2 outline-primary outline-offset-4',
        className,
      )}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
