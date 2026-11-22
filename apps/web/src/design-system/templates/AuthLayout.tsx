import type { ReactNode } from 'react';
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-[640px] gap-6 rounded-lg border border-border bg-surface p-6">
      {children}
    </div>
  );
}
