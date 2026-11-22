import { NavigationItems, type NavigationProps } from './BottomNav';
export function SideRail({ label, ...props }: NavigationProps) {
  return (
    <nav
      aria-label={label}
      className="sticky top-0 hidden shrink-0 flex-col self-start border-r border-border bg-surface p-3 md:flex"
    >
      <NavigationItems {...props} />
    </nav>
  );
}
