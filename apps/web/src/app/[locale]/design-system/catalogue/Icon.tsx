'use client';
import { Icon } from '@/design-system/atoms/Icon';
import { Example, type ExampleProps } from './shared';
import { iconNames } from '@/design-system/atoms/Icon';
export default function IconCatalogue({ t }: ExampleProps) {
  return (
    <>
      {iconNames.map((name) => (
        <Example key={name} label={t.icons[name]}>
          <Icon name={name} label={t.icons[name]} />
        </Example>
      ))}
    </>
  );
}
