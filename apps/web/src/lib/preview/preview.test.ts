// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  fieldTypes,
  formDefinitionSchema,
  type FormDefinition,
} from '@/lib/api/schemas';
import taxFixture from '@/mocks/fixtures/05_nadplata_podatku.json';
import buildingFixture from '@/mocks/fixtures/01_numer_porzadkowy_nieruchomosci.json';
import {
  applyAnswer,
  buildViewModel,
  createState,
  evaluateStates,
  nextStep,
  type FieldView,
  type ViewModel,
} from './index';

const tax = formDefinitionSchema.parse(taxFixture);
const building = formDefinitionSchema.parse(buildingFixture);
function find(view: ViewModel, techName: string): FieldView {
  const flatten = (fields: FieldView[]): FieldView[] =>
    fields.flatMap((field) => [field, ...flatten(field.children)]);
  const field = flatten(view.tabs.flatMap((tab) => tab.questions)).find(
    (field) => field.techName === techName,
  );
  if (!field) throw new Error(`Brak pola ${techName}`);
  return field;
}
function example(states: unknown[] = []): FormDefinition {
  return formDefinitionSchema.parse({
    title: 'Test',
    tabs: [
      {
        id: 'one',
        title: 'Dane',
        questions: [
          {
            field: {
              techName: 'section',
              type: 'SECTION',
              states,
              repeatingSectionGrid: [
                { field: { type: 'TEXT_FIELD', techName: 'answer' } },
              ],
            },
          },
        ],
      },
    ],
  });
}

describe('mapowanie i odpowiedzi', () => {
  it.each(fieldTypes)(
    'mapuje %s i zachowuje metadane, bez Reacta i DOM',
    (type) => {
      const form = formDefinitionSchema.parse({
        title: 'Formularz',
        tabs: [
          {
            title: 'Dane',
            questions: [
              {
                x: 1,
                y: 2,
                rows: 3,
                cols: 4,
                field: {
                  type,
                  techName: 'field',
                  title: 'Etykieta',
                  description: '<p onclick="x()">Opis</p>',
                  readOnly: true,
                  defaultValue: 'abc',
                  validation: ['REQUIRED', 'EMAIL'],
                  options: [{ id: 'a', name: 'Opcja' }],
                  consentSectionConfig: {
                    consents: [
                      {
                        description: '<b onmouseover="x()">Zgoda</b>',
                        required: true,
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
      });
      const field = find(buildViewModel(form), 'field');
      expect(field).toMatchObject({
        type,
        key: '0.0',
        label: 'Etykieta',
        description: '<p>Opis</p>',
        readOnly: true,
        required: true,
        validators: ['REQUIRED', 'EMAIL'],
        layout: { x: 1, y: 2, rows: 3, cols: 4 },
        options: [{ id: 'a', name: 'Opcja' }],
        consents: [{ description: '<b>Zgoda</b>', required: true }],
      });
    },
  );

  it('mapuje zagnieżdżone klucze, słowniki i dane z systemu zewnętrznego', () => {
    const view = buildViewModel(tax);
    expect(find(view, 'kraj')).toMatchObject({
      key: '0.3.6',
      dictionaryName: 'Kraje',
      defaultValue: 'Polska',
    });
    expect(find(view, 'kraj').options.map((option) => option.name)).toEqual([
      'Polska',
      'Niemcy',
      'Czechy',
    ]);
    expect(find(view, 'imie')).toMatchObject({
      readOnly: true,
      defaultValue: 'PESEL.name',
      placeholder: 'PESEL.name',
    });
    view.tabs[0].questions[0].label = 'Zmiana';
    expect(tax.tabs[0].questions[0].field.title).not.toBe('Zmiana');
  });

  it('inicjuje puste i domyślne odpowiedzi, klonuje tablice i nie zmienia wejścia', () => {
    const form = formDefinitionSchema.parse({
      title: 'Test',
      tabs: [
        {
          title: 'Dane',
          questions: [
            'TEXT_FIELD',
            'CHECKBOX',
            'SELECT',
            'CONSENT_SECTION',
          ].map((type) => ({
            field: {
              type,
              techName: type,
              defaultValue:
                type === 'CHECKBOX'
                  ? ['a', 'b']
                  : type === 'SELECT'
                    ? ['Polska']
                    : null,
            },
          })),
        },
      ],
    });
    const before = JSON.stringify(form);
    const state = createState(form);
    expect(
      state.tabs[0].questions.map(({ field }) => field.__userAnswer),
    ).toEqual(['', ['a', 'b'], 'Polska', []]);
    const value = ['c'];
    const updated = applyAnswer(state, 'CHECKBOX', value);
    value.push('d');
    expect(updated.tabs[0].questions[1].field.__userAnswer).toEqual(['c']);
    expect(state.tabs[0].questions[1].field.__userAnswer).toEqual(['a', 'b']);
    expect(JSON.stringify(form)).toBe(before);
    expect(applyAnswer(state, 'nieznane', 'x')).toEqual(state);
  });
});

describe('warunki JSONata', () => {
  it('stosuje SHOW/READ_ONLY, dziedziczenie i resetuje wynik przy kolejnej ocenie', async () => {
    const query =
      'tabs.questions.field.repeatingSectionGrid.field.__userAnswer = "Tak"';
    const form = example([
      { type: 'SHOW', query },
      { type: 'READ_ONLY', query },
    ]);
    const initial = createState(form);
    const before = JSON.stringify(initial);
    const hidden = await evaluateStates(form, initial);
    expect(find(hidden, 'section').visible).toBe(false);
    expect(find(hidden, 'answer').visible).toBe(false);
    const shown = await evaluateStates(
      form,
      applyAnswer(initial, 'answer', 'Tak'),
    );
    expect(find(shown, 'section')).toMatchObject({
      visible: true,
      readOnly: true,
    });
    expect(find(shown, 'answer')).toMatchObject({
      visible: true,
      readOnly: true,
    });
    expect(JSON.stringify(initial)).toBe(before);
    expect(find(await evaluateStates(form, initial), 'section')).toMatchObject({
      visible: false,
      readOnly: false,
    });
  });

  it('łączy SHOW przez AND i respektuje statyczne readOnly', async () => {
    const form = example([
      { type: 'SHOW', query: 'true' },
      { type: 'SHOW', query: 'false' },
      { type: 'READ_ONLY', query: 'false' },
    ]);
    form.tabs[0].questions[0].field.readOnly = true;
    expect(
      find(await evaluateStates(form, createState(form)), 'section'),
    ).toMatchObject({ visible: false, readOnly: true });
  });

  it.each(['(', '$nieistniejaca()', '1 / "x"'])(
    'oznacza błąd %s bez wyjątku i nadal ocenia resztę pól',
    async (query) => {
      const form = example([
        { type: 'SHOW', query },
        { type: 'READ_ONLY', query },
      ]);
      const result = await evaluateStates(form, createState(form));
      expect(find(result, 'section')).toMatchObject({
        visible: false,
        readOnly: true,
        conditionErrors: [
          { type: 'SHOW', query, message: 'błędny warunek' },
          { type: 'READ_ONLY', query, message: 'błędny warunek' },
        ],
      });
      expect(find(result, 'answer').conditionErrors).toEqual([]);
      // Druga ocena obejmuje również błędne wyrażenie z cache.
      expect(await evaluateStates(form, createState(form))).toEqual(result);
    },
  );

  it('konwertuje wyniki zgodnie z JSONata, także puste tablice i brak wartości', async () => {
    for (const [query, visible] of [
      ['[]', false],
      ['missing', false],
      ['[false, false]', false],
      ['"tak"', true],
    ] as const) {
      const form = example([{ type: 'SHOW', query }]);
      expect(
        find(await evaluateStates(form, createState(form)), 'section').visible,
      ).toBe(visible);
    }
  });

  it('obsługuje odpowiedzi checkbox i głębsze sekcje powtarzalne', async () => {
    const form = example();
    const section = form.tabs[0].questions[0].field;
    section.type = 'REPEATING_SECTION';
    section.repeatingSectionGrid[0].field.type = 'CHECKBOX';
    section.states = [
      {
        type: 'SHOW',
        query:
          '"b" in tabs.questions.field.repeatingSectionGrid.field.__userAnswer',
      },
    ];
    const state = applyAnswer(createState(form), 'answer', ['a', 'b']);
    expect(find(await evaluateStates(form, state), 'answer').visible).toBe(
      true,
    );
  });
});

describe.each([
  ['nadpłata', tax],
  ['numer porządkowy', building],
] as const)('akceptacja: %s', (_name, form) => {
  it('odsłania inną osobę, osobę prawną, pełnomocnika i pola zagraniczne', async () => {
    const original = JSON.stringify(form);
    let state = createState(form);
    const initial = await evaluateStates(form, state);
    expect(find(initial, 'dane_innej_osoby').visible).toBe(false);
    expect(find(initial, 'dane_podmiotu').visible).toBe(false);
    expect(find(initial, 'wojewodztwo').visible).toBe(true);
    state = applyAnswer(
      state,
      'wybierz_w_czyim_imieniu_wnioskujesz',
      'Innej osoby',
    );
    const other = await evaluateStates(form, state);
    expect(find(other, 'dane_innej_osoby').visible).toBe(true);
    expect(find(other, 'pelnomocnictwo').visible).toBe(true);
    state = applyAnswer(
      state,
      'wybierz_w_czyim_imieniu_wnioskujesz',
      'Osoby prawnej lub jednostki organizacyjnej',
    );
    const legal = await evaluateStates(form, state);
    for (const name of [
      'wybierz_jako_kto_wnioskujesz',
      'dane_podmiotu',
      'adres_siedziby',
    ]) {
      expect(find(legal, name).visible).toBe(true);
    }
    expect(find(legal, 'dane_innej_osoby').visible).toBe(false);
    state = applyAnswer(state, 'wybierz_jako_kto_wnioskujesz', 'Pełnomocnik');
    expect(
      find(
        await evaluateStates(form, state),
        'oplata_skarbowa_pelnomocnictwo_2',
      ).visible,
    ).toBe(true);
    state = applyAnswer(state, 'wybierz_jako_kto_wnioskujesz', 'Reprezentant');
    const representative = await evaluateStates(form, state);
    expect(
      find(representative, 'potwierdzenie_ze_jestes_reprezentantem').visible,
    ).toBe(true);
    expect(
      find(representative, 'oplata_skarbowa_pelnomocnictwo_2').visible,
    ).toBe(false);
    for (const [country, teryt, foreign] of [
      ['kraj', 'wojewodztwo', 'ulica_zagranica'],
      ['kraj_siedziba', 'wojewodztwo_siedziba', 'ulica_siedziba_zagranica'],
    ]) {
      state = applyAnswer(state, country, 'Niemcy');
      const abroad = await evaluateStates(form, state);
      expect(find(abroad, teryt).visible).toBe(false);
      expect(find(abroad, foreign).visible).toBe(true);
    }
    expect(JSON.stringify(form)).toBe(original);
  });

  it('przechodzi po flow do końca i wraca do poprzedniego kroku', () => {
    const state = createState(form);
    const first = nextStep(form, 0, state);
    expect(first).toMatchObject({
      previous: null,
      next: form.tabs[1].id,
      finished: false,
    });
    expect(nextStep(form, first.next!, state).previous).toBe(form.tabs[0].id);
    expect(nextStep(form, 2, state).next).toBe(form.tabs[3].id);
    expect(nextStep(form, 3, state)).toMatchObject({
      next: null,
      previous: form.tabs[2].id,
      finished: true,
    });
  });
});

it('nadpłata: radio na stronie 2 przełącza nazwę podatku i numer rachunku', async () => {
  let state = createState(tax);
  const initial = await evaluateStates(tax, state);
  expect(find(initial, 'nazwa_podatku').visible).toBe(false);
  expect(find(initial, 'numer_rachunku').visible).toBe(false);
  state = applyAnswer(
    state,
    'wybierz_co_mamy_zrobic_z_nadplata',
    'Zaliczyć na poczet przyszłego zobowiązania podatkowego',
  );
  const offset = await evaluateStates(tax, state);
  expect(find(offset, 'nazwa_podatku').visible).toBe(true);
  expect(find(offset, 'numer_rachunku').visible).toBe(false);
  state = applyAnswer(
    state,
    'wybierz_co_mamy_zrobic_z_nadplata',
    'Zwrócić przelewem na rachunek bankowy',
  );
  const refund = await evaluateStates(tax, state);
  expect(find(refund, 'nazwa_podatku').visible).toBe(false);
  expect(find(refund, 'numer_rachunku').visible).toBe(true);
});

it('nawigacja nie zgaduje kolejności; obsługuje puste dane i uszkodzone odnośniki', () => {
  const form = example();
  const state = createState(form);
  form.flow.links = [{ id: 'broken', source: 'one', target: 'missing' }];
  expect(nextStep(form, 'one', state)).toEqual({
    current: 'one',
    previous: null,
    next: null,
    finished: false,
  });
  expect(nextStep(form, 'missing', state).current).toBeNull();
  const empty = formDefinitionSchema.parse({ title: 'Pusty' });
  expect(buildViewModel(empty).tabs).toEqual([]);
  expect(createState(empty)).toEqual({ tabs: [] });
});
