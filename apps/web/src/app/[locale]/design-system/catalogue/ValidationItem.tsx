'use client';
import { ValidationItem } from '@/design-system/molecules/ValidationItem';
import { Example, type ExampleProps } from './shared';

export default function ValidationItemCatalogue({ t }: ExampleProps) {
  return (
    <>
      {(['error', 'warning'] as const).map((severity) => (
        <Example
          key={severity}
          label={severity === 'error' ? t.errorState : t.warning}
        >
          <ValidationItem
            severity={severity}
            message={t.error}
            path="tabs[0].questions[0]"
            code="REQUIRED"
          />
        </Example>
      ))}
    </>
  );
}
