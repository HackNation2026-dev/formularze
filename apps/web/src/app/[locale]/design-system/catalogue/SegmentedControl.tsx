'use client';
import { useState } from 'react';
import { SegmentedControl } from '@/design-system/molecules/SegmentedControl';
import { Example, type ExampleProps } from './shared';

export default function SegmentedControlCatalogue({ t }: ExampleProps) {
  const [value, setValue] = useState('1');
  return (
    <Example label={t.selected + ' / ' + t.unselected + ' / ' + t.disabled}>
      <SegmentedControl
        name="catalogue-segment"
        label={t.label}
        value={value}
        onChange={setValue}
        options={[
          { value: '1', label: t.option + ' 1' },
          { value: '2', label: t.option + ' 2' },
          { value: '3', label: t.option + ' 3', disabled: true },
        ]}
      />
    </Example>
  );
}
