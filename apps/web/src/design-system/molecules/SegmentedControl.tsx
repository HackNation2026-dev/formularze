import { Radio } from '../atoms/Radio';
export interface SegmentedControlProps {
  label: string;
  name: string;
  value: string;
  options: readonly { value: string; label: string; disabled?: boolean }[];
  onChange: (value: string) => void;
}
export function SegmentedControl({
  label,
  name,
  value,
  options,
  onChange,
}: SegmentedControlProps) {
  return (
    <fieldset className="rounded-md border border-border-strong p-2">
      <legend className="px-2 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-4">
        {options.map((option) => (
          <Radio
            key={option.value}
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={option.disabled}
            onChange={() => onChange(option.value)}
            label={option.label}
          />
        ))}
      </div>
    </fieldset>
  );
}
