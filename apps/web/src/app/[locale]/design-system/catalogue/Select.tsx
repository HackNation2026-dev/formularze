'use client';
import { Select } from '@/design-system/atoms/Select';
import { Example, states, stateLabel, type ExampleProps } from './shared';

export default function SelectCatalogue({ t }: ExampleProps) {
  return (
    <>
      {states.map((state) => (
        <Example key={state} label={stateLabel(t, state)}>
          <Select
            aria-label={t.label + ' ' + stateLabel(t, state)}
            state={state === 'disabled' ? 'default' : state}
            disabled={state === 'disabled'}
          >
            <option>{t.option} 1</option>
            <option>{t.option} 2</option>
          </Select>
        </Example>
      ))}
    </>
  );
}
