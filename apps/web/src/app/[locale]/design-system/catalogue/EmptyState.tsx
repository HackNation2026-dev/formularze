'use client';
import { EmptyState } from '@/design-system/molecules/EmptyState';
import { Example, type ExampleProps } from './shared';
import { Button } from '@/design-system/atoms/Button';
export default function EmptyStateCatalogue({ t }: ExampleProps) {
  return (
    <>
      <Example label={t.default}>
        <EmptyState title={t.empty} description={t.emptyDescription} />
      </Example>
      <Example label={t.action}>
        <EmptyState
          title={t.empty}
          description={t.emptyDescription}
          action={<Button>{t.action}</Button>}
        />
      </Example>
    </>
  );
}
