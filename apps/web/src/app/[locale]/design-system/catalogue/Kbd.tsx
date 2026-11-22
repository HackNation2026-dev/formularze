'use client';
import { Kbd } from '@/design-system/atoms/Kbd';
import { Example, type ExampleProps } from './shared';

export default function KbdCatalogue({ t }: ExampleProps) {
  return (
    <Example label={t.default}>
      <Kbd>Ctrl + Enter</Kbd>
    </Example>
  );
}
