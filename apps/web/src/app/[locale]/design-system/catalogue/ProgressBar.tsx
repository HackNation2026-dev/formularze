'use client';
import { ProgressBar } from '@/design-system/atoms/ProgressBar';
import { Example, type ExampleProps } from './shared';

export default function ProgressBarCatalogue({ t }: ExampleProps) {
  return (
    <>
      {[0, 45, 100, undefined].map((value) => (
        <Example
          key={String(value)}
          label={value === undefined ? t.indeterminate : String(value) + '%'}
        >
          <ProgressBar label={t.progress} value={value} />
        </Example>
      ))}
    </>
  );
}
