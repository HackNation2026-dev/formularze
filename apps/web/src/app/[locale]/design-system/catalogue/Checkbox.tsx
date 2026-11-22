'use client';
import { Checkbox } from '@/design-system/atoms/Checkbox';
import { Example, type ExampleProps } from './shared';

export default function CheckboxCatalogue({ t }: ExampleProps) {
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
            <Checkbox
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
