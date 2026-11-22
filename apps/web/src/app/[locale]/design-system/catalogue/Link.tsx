'use client';
import { Link } from '@/design-system/atoms/Link';
import { Example, type ExampleProps } from './shared';

export default function LinkCatalogue({ t }: ExampleProps) {
  return (
    <Example label={t.default}>
      <Link href="#tokens">{t.tokens}</Link>
    </Example>
  );
}
