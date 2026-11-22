'use client';
import { StepIndicator } from '@/design-system/molecules/StepIndicator';
import { Example, type ExampleProps } from './shared';

export default function StepIndicatorCatalogue({ t }: ExampleProps) {
  return (
    <>
      {[0, 1, 2].map((current) => (
        <Example key={current} label={String(current + 1)}>
          <StepIndicator
            label={t.steps}
            steps={[t.step1, t.step2, t.step3]}
            current={current}
          />
        </Example>
      ))}
    </>
  );
}
