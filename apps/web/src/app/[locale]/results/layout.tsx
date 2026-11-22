import type { ReactNode } from 'react';
import { ApplicationShell } from '@/design-system/templates/AppShell/Connected';
export default function Layout({ children }: { children: ReactNode }) {
  return <ApplicationShell>{children}</ApplicationShell>;
}
