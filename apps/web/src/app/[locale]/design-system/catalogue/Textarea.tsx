'use client';
import { Textarea } from '@/design-system/atoms/Textarea';
import { Example, states, stateLabel, type ExampleProps } from './shared';

export default function TextareaCatalogue({ t }: ExampleProps) {
  return (
    <>
      {states.map((state) => (
        <Example key={state} label={stateLabel(t, state)}>
          <Textarea
            aria-label={t.label + ' ' + stateLabel(t, state)}
            state={state === 'disabled' ? 'default' : state}
            disabled={state === 'disabled'}
            placeholder={t.sample}
          />
        </Example>
      ))}
    </>
  );
}
