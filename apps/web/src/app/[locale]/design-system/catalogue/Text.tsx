'use client';
import { Text } from '@/design-system/atoms/Text';
import { Example, type ExampleProps } from './shared';

export default function TextCatalogue({ t }: ExampleProps) {
  return (
    <>
      {(['body', 'heading', 'caption', 'code'] as const).flatMap((variant) =>
        [false, true].map((muted) => (
          <Example key={variant + muted} label={variant}>
            <Text variant={variant} muted={muted}>
              {t.sample}
            </Text>
          </Example>
        )),
      )}
    </>
  );
}
