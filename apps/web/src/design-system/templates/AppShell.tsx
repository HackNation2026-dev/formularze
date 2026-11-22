import type { ReactNode } from 'react';
import { AppBar, type AppBarProps } from '../organisms/AppBar';
import { BottomNav, type NavigationProps } from '../organisms/BottomNav';
import { SideRail } from '../organisms/SideRail';
export interface AppShellProps extends AppBarProps {
  navigation: NavigationProps;
  children: ReactNode;
}
export function AppShell({ children, navigation, ...bar }: AppShellProps) {
  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <AppBar {...bar} />
      <div className="flex min-w-0">
        <SideRail {...navigation} />
        <main className="mx-auto w-full min-w-0 max-w-[640px] p-4 pb-8 md:p-6">
          {children}
        </main>
      </div>
      <BottomNav {...navigation} />
    </div>
  );
}
