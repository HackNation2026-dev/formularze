import type { HTMLAttributes } from 'react';
export function Kbd(props: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      {...props}
      className="rounded-md border border-border-strong bg-background px-2 py-1 font-mono text-sm"
    />
  );
}
