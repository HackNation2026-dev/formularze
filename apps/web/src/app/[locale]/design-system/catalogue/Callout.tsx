'use client';
import { Callout } from '@/design-system/molecules/Callout';
import { Example, tones, type ExampleProps } from './shared';

export default function CalloutCatalogue({ t }: ExampleProps) {
  return (
    <>
      {tones.map((tone) => (
        <Example key={tone} label={t[tone]}>
          <Callout tone={tone} title={t[tone]}>
            {t.sample}
          </Callout>
        </Example>
      ))}
    </>
  );
}
