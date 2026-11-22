'use client';
import { Button } from '@/design-system/atoms/Button';
import { Example, type ExampleProps } from './shared';

export default function ButtonCatalogue({ t }: ExampleProps) {
  return (
    <>
      {(['primary', 'secondary', 'ghost', 'danger'] as const).flatMap(
        (variant) =>
          (['default', 'hover', 'focus', 'disabled', 'loading'] as const).map(
            (state) => (
              <Example
                key={variant + state}
                label={t[variant] + ' · ' + t[state]}
              >
                <Button
                  variant={variant}
                  state={
                    state === 'hover' || state === 'focus' ? state : 'default'
                  }
                  disabled={state === 'disabled'}
                  loading={state === 'loading'}
                >
                  {t.action}
                </Button>
              </Example>
            ),
          ),
      )}
    </>
  );
}
