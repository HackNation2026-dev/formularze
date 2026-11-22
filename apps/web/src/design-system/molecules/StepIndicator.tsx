import { cx } from '../atoms/styles';
export interface StepIndicatorProps {
  label: string;
  steps: readonly string[];
  current: number;
}
export function StepIndicator({ label, steps, current }: StepIndicatorProps) {
  return (
    <nav aria-label={label}>
      <ol className="flex flex-wrap gap-4">
        {steps.map((step, index) => (
          <li
            key={`${index}-${step}`}
            aria-current={index === current ? 'step' : undefined}
            className={cx(
              'flex items-center gap-2',
              index === current
                ? 'font-semibold text-primary'
                : index < current
                  ? 'text-success'
                  : 'text-muted',
            )}
          >
            <span className="rounded-sm border border-current px-2 py-1">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </nav>
  );
}
