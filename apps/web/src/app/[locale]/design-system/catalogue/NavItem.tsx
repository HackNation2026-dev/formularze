'use client';
import { NavItem } from '@/design-system/molecules/NavItem';
import { Example, type ExampleProps } from './shared';

export default function NavItemCatalogue({ t }: ExampleProps) {
  return (
    <Example label={t.active + ' / ' + t.inactive}>
      <nav aria-label={t.navigation} className="flex flex-wrap">
        <NavItem href="#atoms" active>
          {t.atoms}
        </NavItem>
        <NavItem href="#molecules">{t.molecules}</NavItem>
      </nav>
    </Example>
  );
}
