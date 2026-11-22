'use client';
import { Divider } from '@/design-system/atoms/Divider';
import { Example, type ExampleProps } from './shared';

export default function DividerCatalogue({ t }: ExampleProps) {
  return (
    <Example label={t.default}>
      <Divider />
    </Example>
  );
}
