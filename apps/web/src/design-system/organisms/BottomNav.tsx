import { NavItem } from '../molecules/NavItem';
export interface NavigationItem {
  href: string;
  label: string;
  active?: boolean;
}
export interface NavigationProps {
  label: string;
  items: NavigationItem[];
  onNavigate?: (href: string) => void;
}
export function NavigationItems({
  items,
  onNavigate,
}: Pick<NavigationProps, 'items' | 'onNavigate'>) {
  return items.map((item) => (
    <NavItem
      key={item.href}
      href={item.href}
      active={item.active}
      onClick={(event) => {
        if (
          onNavigate &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          !event.altKey &&
          event.button === 0
        ) {
          event.preventDefault();
          onNavigate(item.href);
        }
      }}
    >
      {item.label}
    </NavItem>
  ));
}
export function BottomNav({ label, ...props }: NavigationProps) {
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-border bg-surface p-2 md:hidden"
    >
      <NavigationItems {...props} />
    </nav>
  );
}
