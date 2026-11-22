'use client';
import { Skeleton } from '@/design-system/atoms/Skeleton';
import { Example, type ExampleProps } from './shared';

export default function SkeletonCatalogue({ t }: ExampleProps) {
  return (
    <Example label={t.loading}>
      <Skeleton label={t.loading} />
    </Example>
  );
}
