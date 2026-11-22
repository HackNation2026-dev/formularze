import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { TokenTheme } from './Tokens';
function luminance(hex: string) {
  const values = hex
    .slice(1)
    .match(/../g)!
    .map((part) => {
      const value = parseInt(part, 16) / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
export function tokenThemes(): TokenTheme[] {
  const css = readFileSync(
    path.join(process.cwd(), 'src/design-system/tokens/tokens.generated.css'),
    'utf8',
  );
  return (['Light', 'Dark'] as const).map((name) => {
    const section = css.split(`/* Theme · ${name} */`)[1].split('/*')[0];
    const colors = [...section.matchAll(/--color-([\w-]+):\s*([^;]+);/g)].map(
      (match) => ({ name: match[1], value: match[2].trim() }),
    );
    const surface = luminance(
      colors.find((color) => color.name === 'surface')!.value,
    );
    return {
      name,
      colors: colors.map((color) => {
        const light = luminance(color.value);
        return {
          ...color,
          contrast:
            (Math.max(light, surface) + 0.05) /
            (Math.min(light, surface) + 0.05),
        };
      }),
    };
  });
}
