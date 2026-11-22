// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { messages } from '@/i18n/messages';
import { formDefinitionSchema } from '@/lib/api/schemas';

function keys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return [prefix];
  return Object.entries(value)
    .flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key))
    .sort();
}
describe('źródła prawdy', () => {
  it('lockfile nie zawiera zależności GPL, LGPL ani AGPL', async () => {
    const lock = JSON.parse(
      await readFile(
        new URL('../../package-lock.json', import.meta.url),
        'utf8',
      ),
    ) as { packages: Record<string, { license?: string }> };
    for (const [name, dependency] of Object.entries(lock.packages)) {
      expect(dependency.license ?? '', name).not.toMatch(
        /\b(?:A?GPL|LGPL|SSPL)(?:-|\b)/,
      );
    }
  });
  it('kopia tokenów jest identyczna ze źródłem', async () => {
    expect(
      await readFile(
        new URL(
          '../design-system/tokens/tokens.generated.css',
          import.meta.url,
        ),
        'utf8',
      ),
    ).toBe(
      await readFile(
        new URL('../../../../design/tokens.css', import.meta.url),
        'utf8',
      ),
    );
  });
  it('tłumaczenia mają te same klucze i są załadowane', async () => {
    const pl = new URL('../../messages/pl/', import.meta.url);
    const en = new URL('../../messages/en/', import.meta.url);
    const files = (await readdir(pl))
      .filter((file) => file.endsWith('.json'))
      .sort();
    expect(files).toEqual(
      (await readdir(en)).filter((file) => file.endsWith('.json')).sort(),
    );
    for (const name of files) {
      const left: unknown = JSON.parse(
        await readFile(new URL(name, pl), 'utf8'),
      );
      const right: unknown = JSON.parse(
        await readFile(new URL(name, en), 'utf8'),
      );
      expect(keys(left)).toEqual(keys(right));
      const namespace = name.replace('.json', '');
      expect(messages.pl).toHaveProperty(namespace, left);
      expect(messages.en).toHaveProperty(namespace, right);
    }
  });
  it('wszystkie fixtures są identyczne z materiałami, formularze spełniają schemat', async () => {
    const source = new URL(
      '../../../../data/input/02_przyklady_json/',
      import.meta.url,
    );
    const target = new URL('../mocks/fixtures/', import.meta.url);
    const files = (await readdir(source))
      .filter((name) => name.endsWith('.json'))
      .sort();
    expect(files).toEqual(
      (await readdir(target)).filter((name) => name.endsWith('.json')).sort(),
    );
    for (const name of files) {
      const contents = await readFile(new URL(name, source), 'utf8');
      expect(await readFile(new URL(name, target), 'utf8')).toBe(contents);
      if (name !== 'importowanyPlikJsonSchemat.json')
        expect(
          formDefinitionSchema.safeParse(JSON.parse(contents)).success,
        ).toBe(true);
    }
  });
});
