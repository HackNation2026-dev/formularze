'use client';
import { KeyValue } from '@/design-system/molecules/KeyValue';
import { Example, type ExampleProps } from './shared';

export default function KeyValueCatalogue({ t }: ExampleProps) {
  return (
    <Example label={t.default}>
      <KeyValue label={t.label} value={t.sample} />
    </Example>
  );
}
