'use client';
import { StatusChip } from '@/design-system/molecules/StatusChip';
import { Example, tones, type ExampleProps } from './shared';

export default function StatusChipCatalogue({ t }: ExampleProps) {
  return (
    <>
      {tones.map((tone) => (
        <Example key={tone} label={t[tone]}>
          <StatusChip tone={tone}>{t[tone]}</StatusChip>
        </Example>
      ))}
    </>
  );
}
