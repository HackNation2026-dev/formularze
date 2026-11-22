import type { CSSProperties } from 'react';
import type { Copy } from './shared';
export interface TokenTheme {
  name: 'Light' | 'Dark';
  colors: { name: string; value: string; contrast: number }[];
}
const swatches: Record<string, string> = {
  background: 'bg-background',
  surface: 'bg-surface',
  border: 'bg-border',
  'border-strong': 'bg-border-strong',
  text: 'bg-text',
  muted: 'bg-muted',
  primary: 'bg-primary',
  'primary-foreground': 'bg-primary-foreground',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};
const spaces = ['w-1', 'w-2', 'w-3', 'w-4', 'w-5', 'w-6', 'w-7', 'w-8'];
export function Tokens({ themes, t }: { themes: TokenTheme[]; t: Copy }) {
  return (
    <section id="tokens" className="grid gap-6">
      <h2 className="text-2xl font-semibold">{t.tokens}</h2>
      <h3 className="text-xl font-semibold">{t.colors}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {themes.map((theme) => (
          <div
            key={theme.name}
            data-theme={theme.name}
            style={
              Object.fromEntries(
                theme.colors.map((color) => [
                  `--color-${color.name}`,
                  color.value,
                ]),
              ) as CSSProperties
            }
            className="rounded-lg border border-border bg-surface p-4 text-text"
          >
            <h4 className="mb-4 font-semibold">{t[theme.name]}</h4>
            <ul className="grid gap-3">
              {theme.colors.map((color) => (
                <li key={color.name} className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={`size-8 shrink-0 rounded-sm border border-border-strong ${swatches[color.name]}`}
                  />
                  <span className="min-w-0 flex-1 break-words font-mono text-sm">
                    {color.name}
                  </span>
                  <span
                    className="font-mono text-sm"
                    aria-label={`${t.contrast}: ${color.contrast.toFixed(2)}:1`}
                  >
                    {color.contrast.toFixed(2)}:1
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <h3 className="text-xl font-semibold">{t.typography}</h3>
      <p className="font-sans text-2xl">Inter · {t.sample}</p>
      <p className="font-mono">Source Code Pro · {t.sample}</p>
      <h3 className="text-xl font-semibold">{t.spacing}</h3>
      <ul className="grid gap-2">
        {[4, 8, 12, 16, 20, 24, 32, 40].map((value, index) => (
          <li key={value} className="flex items-center gap-4">
            <span className="w-8 font-mono text-sm">{value}</span>
            <span className={`h-4 bg-primary ${spaces[index]}`} />
          </li>
        ))}
      </ul>
      <h3 className="text-xl font-semibold">{t.radius}</h3>
      <div className="flex flex-wrap gap-4">
        {(['rounded-sm', 'rounded-md', 'rounded-lg'] as const).map(
          (radius, index) => (
            <div
              key={radius}
              className={`border border-border-strong bg-surface p-4 ${radius}`}
            >
              <span className="font-mono">{[6, 10, 16][index]} px</span>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
