'use client';
import { FormField } from '@/design-system/molecules/FormField';
import { Example, states, stateLabel, type ExampleProps } from './shared';
import { TextInput } from '@/design-system/atoms/TextInput';
export default function FormFieldCatalogue({ t }: ExampleProps) {
  return (
    <>
      {states.map((state) => (
        <Example key={state} label={stateLabel(t, state)}>
          <FormField
            label={t.label}
            helper={t.helper}
            required
            state={state === 'disabled' ? 'default' : state}
            error={state === 'error' ? t.error : undefined}
          >
            <TextInput
              disabled={state === 'disabled'}
              placeholder={state === 'externalSystem' ? t.external : t.sample}
            />
          </FormField>
        </Example>
      ))}
    </>
  );
}
