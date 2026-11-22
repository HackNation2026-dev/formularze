'use client';
import { IconButton } from '@/design-system/atoms/IconButton';
import { Example, type ExampleProps } from './shared';

export default function IconButtonCatalogue({ t }: ExampleProps) {
  return (
    <>
      {(['menu', 'close'] as const).flatMap((icon) =>
        (['default', 'hover', 'focus', 'disabled', 'loading'] as const).map(
          (state) => (
            <Example
              key={icon + state}
              label={`${t.icons[icon]} · ${t[state]}`}
            >
              <IconButton
                icon={icon}
                label={icon === 'close' ? t.close : t.navigation}
                state={
                  state === 'hover' || state === 'focus' ? state : 'default'
                }
                disabled={state === 'disabled'}
                loading={state === 'loading'}
              />
            </Example>
          ),
        ),
      )}
    </>
  );
}
