'use client';
import { Badge } from '@/design-system/atoms/Badge';
import { Example, tones, type ExampleProps } from './shared';

export default function BadgeCatalogue({ t }: ExampleProps) {
  return (
    <>
      {tones.map((tone) => (
        <Example key={tone} label={t[tone]}>
          <Badge tone={tone}>{t[tone]}</Badge>
        </Example>
      ))}
    </>
  );
}
