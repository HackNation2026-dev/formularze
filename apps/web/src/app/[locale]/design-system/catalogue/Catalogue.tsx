'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from '@/app/providers';
import { usePathname } from '@/i18n/navigation';
import { Select } from '@/design-system/atoms/Select';
import { catalogue } from './index';
import { Tokens, type TokenTheme } from './Tokens';
import type { Copy } from './shared';
export function Catalogue({ t, themes }: { t: Copy; themes: TokenTheme[] }) {
  const locale = useLocale();
  const r = useTranslations('results');
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  return (
    <main className="mx-auto grid max-w-5xl gap-8 p-4 md:p-6">
      <header className="grid gap-4">
        <h1 className="text-3xl font-semibold">{t.title}</h1>
        <p className="text-muted">{t.description}</p>
        <div className="flex flex-wrap gap-4">
          <label className="grid gap-2">
            {t.theme}
            <Select
              value={theme}
              onChange={(event) =>
                setTheme(event.target.value as 'Light' | 'Dark' | 'System')
              }
            >
              {(['Light', 'Dark', 'System'] as const).map((value) => (
                <option key={value} value={value}>
                  {t[value]}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-2">
            {t.language}
            <Select
              value={locale}
              onChange={(event) => {
                const value = event.target.value as 'pl' | 'en';
                try {
                  localStorage.setItem('formgen.locale', value);
                } catch {
                  /* Preferencja nie wymaga zapisu. */
                }
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Pełne przejście ponownie wykonuje skrypt motywu w layoucie W1, bez ostrzeżenia React o skrypcie przy zmianie języka.
                window.location.assign(`/${value}${pathname}`);
              }}
            >
              {(['pl', 'en'] as const).map((value) => (
                <option key={value} value={value}>
                  {t[value]}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <nav aria-label={t.navigation} className="flex flex-wrap gap-4">
          {(
            ['tokens', 'atoms', 'molecules', 'organisms', 'templates'] as const
          ).map((layer) => (
            <a key={layer} href={`#${layer}`} className="underline">
              {layer === 'organisms' || layer === 'templates'
                ? r(layer)
                : t[layer]}
            </a>
          ))}
        </nav>
      </header>
      <Tokens t={t} themes={themes} />
      {(['atoms', 'molecules', 'organisms', 'templates'] as const).map(
        (layer) => (
          <section key={layer} id={layer} className="grid gap-6">
            <h2 className="text-2xl font-semibold">
              {layer === 'organisms' || layer === 'templates'
                ? r(layer)
                : t[layer]}
            </h2>
            {catalogue
              .filter((item) => item.layer === layer)
              .map(({ name, Component }) => (
                <section key={name} id={name} className="grid min-w-0 gap-4">
                  <h3 className="text-xl font-semibold">{name}</h3>
                  <div className="grid min-w-0 gap-4 md:grid-cols-2">
                    <Component t={t} />
                  </div>
                </section>
              ))}
          </section>
        ),
      )}
    </main>
  );
}
