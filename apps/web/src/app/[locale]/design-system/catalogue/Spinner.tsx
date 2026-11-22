'use client';
import { Spinner } from '@/design-system/atoms/Spinner';
import { Example, type ExampleProps } from './shared';

export default function SpinnerCatalogue({ t }: ExampleProps) {
  return (
    <Example label={t.loading}>
      <Spinner label={t.loading} />
    </Example>
  );
}
