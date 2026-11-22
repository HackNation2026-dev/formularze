// @vitest-environment node
import { expect, it, vi } from 'vitest';
import jsonata from 'jsonata';
import { formDefinitionSchema } from '@/lib/api/schemas';
import { createState, evaluateStates } from './index';

vi.mock('jsonata', async (importOriginal) => {
  const original = await importOriginal<{ default: typeof jsonata }>();
  return { default: vi.fn(original.default) };
});

it.each(['"cache-probe" = "cache-probe"', 'cache-probe('])(
  'kompiluje tylko raz, także błędne wyrażenie: %s',
  async (query) => {
    vi.mocked(jsonata).mockClear();
    const form = formDefinitionSchema.parse({
      title: 'Cache',
      tabs: [
        {
          title: 'Dane',
          questions: [
            {
              field: {
                type: 'TEXT_FIELD',
                techName: 'pole',
                states: [{ type: 'SHOW', query }],
              },
            },
          ],
        },
      ],
    });
    const state = createState(form);
    const first = await evaluateStates(form, state);
    expect(await evaluateStates(form, state)).toEqual(first);
    expect(jsonata).toHaveBeenCalledTimes(1);
  },
);

it('przerywa zapętlony warunek i zwraca znacznik błędu', async () => {
  const form = formDefinitionSchema.parse({
    title: 'Limit',
    tabs: [
      {
        title: 'Dane',
        questions: [
          {
            field: {
              type: 'TEXT_FIELD',
              techName: 'pole',
              states: [
                {
                  type: 'SHOW',
                  query: '($loop := function(){ $loop() }; $loop())',
                },
              ],
            },
          },
        ],
      },
    ],
  });
  const view = await evaluateStates(form, createState(form));
  expect(view.tabs[0].questions[0].conditionErrors[0]?.message).toBe(
    'błędny warunek',
  );
});
