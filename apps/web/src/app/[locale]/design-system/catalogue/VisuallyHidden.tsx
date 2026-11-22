'use client';
import { VisuallyHidden } from '@/design-system/atoms/VisuallyHidden';
import { Example, type ExampleProps } from './shared';

export default function VisuallyHiddenCatalogue({ t }: ExampleProps) {
  return (
    <Example label={t.hidden}>
      <VisuallyHidden>{t.hidden}</VisuallyHidden>
    </Example>
  );
}
