'use client';
import { Radio } from '@/design-system/atoms/Radio';
import { Example, type ExampleProps } from './shared';

export default function RadioCatalogue({ t }: ExampleProps) {
  return (
    <>
      {[false, true].flatMap((checked) =>
        [false, true].map((disabled) => (
          <Example
            key={String(checked) + disabled}
            label={
              (checked ? t.selected : t.unselected) +
              ' · ' +
              (disabled ? t.disabled : t.default)
            }
          >
            <Radio
              name={'radio-' + checked + disabled}
              label={t.option}
              defaultChecked={checked}
              disabled={disabled}
            />
          </Example>
        )),
      )}
    </>
  );
}
