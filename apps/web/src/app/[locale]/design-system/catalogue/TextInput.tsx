'use client';
import { TextInput } from '@/design-system/atoms/TextInput';
import { Example, states, stateLabel, type ExampleProps } from './shared';

export default function TextInputCatalogue({ t }: ExampleProps) {
  return (
    <>
      {states.map((state) => (
        <Example key={state} label={stateLabel(t, state)}>
          <TextInput
            aria-label={t.label + ' ' + stateLabel(t, state)}
            state={state === 'disabled' ? 'default' : state}
            disabled={state === 'disabled'}
            placeholder={state === 'externalSystem' ? t.external : t.sample}
          />
        </Example>
      ))}
    </>
  );
}
