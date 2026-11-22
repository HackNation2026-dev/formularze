'use client';
import { useState } from 'react';
import { Chip } from '@/design-system/molecules/Chip';
import { Example, type ExampleProps } from './shared';

export default function ChipCatalogue({ t }: ExampleProps) {
  const [removed, setRemoved] = useState(false);
  return (
    <>
      <Example label={t.default}>
        <Chip>{t.sample}</Chip>
      </Example>
      <Example label={t.remove}>
        {!removed && (
          <Chip onRemove={() => setRemoved(true)} removeLabel={t.remove}>
            {t.sample}
          </Chip>
        )}
      </Example>
    </>
  );
}
