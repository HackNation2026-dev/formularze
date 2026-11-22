// @vitest-environment node
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import pl from '../../../messages/pl/design-system.json';
import en from '../../../messages/en/design-system.json';
async function sources(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries
        .filter((entry) => entry.name !== 'tokens')
        .map(async (entry) =>
          entry.isDirectory()
            ? sources(path.join(directory, entry.name))
            : /\.(tsx?|css)$/.test(entry.name)
              ? [path.join(directory, entry.name)]
              : [],
        ),
    )
  ).flat();
}
describe('kontrakty design systemu', () => {
  it('atomy i molekuły nie używają rounded-sm ani modyfikatora important', async () => {
    const files = (
      await Promise.all(
        ['atoms', 'molecules'].map((layer) =>
          sources(path.join(process.cwd(), 'src/design-system', layer)),
        ),
      )
    ).flat();
    for (const file of files.filter((file) => !/\.test\.tsx?$/.test(file))) {
      const source = ts.createSourceFile(
        file,
        await readFile(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      function check(node: ts.Node) {
        if (ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node)) {
          const forbidden = node.text
            .split(/\s+/)
            .filter(
              (token) => /\brounded-sm\b/.test(token) || token.includes('!'),
            );
          expect(forbidden, file).toEqual([]);
        }
        ts.forEachChild(node, check);
      }
      check(source);
    }
  });
  it('PL i EN mają identyczne klucze i niepuste teksty', () => {
    function entries(value: unknown, prefix = ''): [string, string][] {
      if (typeof value === 'string') return [[prefix, value]];
      return Object.entries(value as Record<string, unknown>).flatMap(
        ([key, child]) => entries(child, `${prefix}.${key}`),
      );
    }
    expect(
      entries(pl)
        .map(([key]) => key)
        .sort(),
    ).toEqual(
      entries(en)
        .map(([key]) => key)
        .sort(),
    );
    for (const [, value] of [...entries(pl), ...entries(en)])
      expect(value.trim().length).toBeGreaterThan(0);
  });
  it('komponenty używają tokenów zamiast surowych kolorów', async () => {
    const files = await sources(path.join(process.cwd(), 'src/design-system'));
    for (const file of files.filter(
      (file) => !file.endsWith('.test.ts') && !file.endsWith('.test.tsx'),
    )) {
      const source = await readFile(file, 'utf8');
      expect(source, file).not.toMatch(
        /#[\da-f]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/i,
      );
      expect(source, file).not.toMatch(/(?:bg|text|border|outline|ring)-\[/);
    }
  });
  it('atomy nie importują wyższych warstw', async () => {
    for (const file of await sources(
      path.join(process.cwd(), 'src/design-system/atoms'),
    ))
      expect(await readFile(file, 'utf8'), file).not.toMatch(
        /from\s+['"][^'"]*(?:molecules|organisms|templates)/,
      );
  });
});
