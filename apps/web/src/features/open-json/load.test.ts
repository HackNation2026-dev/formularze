import { expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { getResult } from '@/features/results';
import { openJson } from './load';
function jsonFile(content: string) {
  const file = new File([content], 'form.json');
  Object.defineProperty(file, 'text', { value: async () => content });
  return file;
}
it('otwiera lokalny wynik bez żądania analizy', async () => {
  const analyze = vi.spyOn(api, 'analyze');
  const id = await openJson(jsonFile('{"title":"Local","tabs":[]}'));
  expect(id).toMatch(/^local-/);
  expect(getResult(id)?.form.title).toBe('Local');
  expect(analyze).not.toHaveBeenCalled();
  expect(getResult(id)?.source).toBe('local');
  analyze.mockRestore();
});
it.each(['{broken', '{}', '[]'])(
  'odrzuca niepoprawny JSON %s',
  async (content) => {
    await expect(openJson(jsonFile(content))).rejects.toThrow();
  },
);
