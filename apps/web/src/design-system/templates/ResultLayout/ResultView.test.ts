import { describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/',
  useLocale: () => 'pl',
  useRouter: () => ({}),
}));

import { showValidationList } from './ResultView';
import type { ValidationResult } from '@/lib/api/schemas';

const data = (partial: {
  errors?: ValidationResult['errors'];
  warnings?: ValidationResult['warnings'];
  sample_errors?: ValidationResult['sample_errors'];
  sample_unknown?: string[];
}): ValidationResult => ({
  valid: true,
  errors: partial.errors ?? [],
  warnings: partial.warnings ?? [],
  sample_errors: partial.sample_errors ?? [],
  sample_unknown: partial.sample_unknown ?? [],
});

describe('widoczność listy walidacji', () => {
  it('lista widoczna przy błędach i ostrzeżeniach', () => {
    expect(
      showValidationList(
        data({
          errors: [
            {
              code: 'R1',
              severity: 'error',
              message: 'm',
              path: 'tabs[0]',
            },
          ],
        }),
      ),
    ).toBe(true);
    expect(
      showValidationList(
        data({
          warnings: [
            {
              code: 'R2',
              severity: 'warning',
              message: 'm',
              path: 'tabs[0]',
            },
          ],
        }),
      ),
    ).toBe(true);
  });

  it('lista chowana, gdy jedynie sample_unknown — callout mówi sam za siebie', () => {
    expect(showValidationList(data({ sample_unknown: ['a', 'b'] }))).toBe(false);
  });

  it('lista chowana przy sample_errors — pokazuje je czerwony callout', () => {
    expect(
      showValidationList(
        data({
          sample_errors: [
            { techName: 'pesel', value: '1', failed: ['PESEL'] },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('czysty wynik pokazuje listę z „brak uwag”', () => {
    expect(showValidationList(data({}))).toBe(true);
  });
});
