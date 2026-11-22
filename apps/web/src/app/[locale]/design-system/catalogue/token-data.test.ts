// @vitest-environment node
import { expect, it } from 'vitest';
import { tokenThemes } from './token-data';
it('kontrast jest liczony z aktualnego źródła tokenów dla obu motywów', () => {
  const themes = tokenThemes();
  expect(themes.map((theme) => theme.name)).toEqual(['Light', 'Dark']);
  for (const theme of themes) {
    expect(theme.colors).toHaveLength(12);
    expect(
      theme.colors.find((color) => color.name === 'surface')?.contrast,
    ).toBe(1);
    for (const name of [
      'text',
      'muted',
      'primary',
      'success',
      'warning',
      'danger',
      'info',
    ])
      expect(
        theme.colors.find((color) => color.name === name)!.contrast,
        name,
      ).toBeGreaterThanOrEqual(4.5);
    expect(
      theme.colors.find((color) => color.name === 'border-strong')!.contrast,
    ).toBeGreaterThanOrEqual(3);
  }
});
