'use client';
import { ChoiceGroup } from '@/design-system/molecules/ChoiceGroup';
import { Example, type ExampleProps } from './shared';
import { Checkbox } from '@/design-system/atoms/Checkbox';
export default function ChoiceGroupCatalogue({ t }: ExampleProps) {
  return (
    <>
      {[false, true].map((error) => (
        <Example key={String(error)} label={error ? t.errorState : t.default}>
          <ChoiceGroup
            label={t.label}
            helper={t.helper}
            error={error ? t.error : undefined}
          >
            <Checkbox label={t.option + ' 1'} />
            <Checkbox label={t.option + ' 2'} />
          </ChoiceGroup>
        </Example>
      ))}
    </>
  );
}
