import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { FormRenderer } from './FormRenderer';
import { JsonViewer } from './JsonViewer';
import { ValidationList } from './ValidationList';
import { ResultLayout } from '../templates/ResultLayout';
import { jsonLabels, previewLabels } from '@/features/results/labels';
import { formDefinitionSchema } from '@/lib/api/schemas';
import fixture from '@/mocks/fixtures/05_nadplata_podatku.json';
import results from '../../../messages/pl/results.json';
import preview from '../../../messages/pl/preview.json';
const labels = previewLabels((key, values) =>
  preview[key as keyof typeof preview].replace(
    '{name}',
    String(values?.name ?? ''),
  ),
);
const jsonCopy = jsonLabels((key) => results[key as keyof typeof results]);
afterEach(cleanup);
async function select(name: string) {
  fireEvent.click(await screen.findByRole('radio', { name }));
}
function section(name: string) {
  return screen.queryByRole('heading', { name });
}
describe('renderer fixture nadpłaty', () => {
  it('przełącza osobę, pełnomocnika, kraj i pola strony 2', async () => {
    render(
      <FormRenderer
        form={formDefinitionSchema.parse(fixture)}
        labels={labels}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Innej osoby' })).toBeEnabled(),
    );
    expect(section('Dane innej osoby')).not.toBeInTheDocument();
    await select('Innej osoby');
    await waitFor(() =>
      expect(section('Dane innej osoby')).toBeInTheDocument(),
    );
    expect(section('Pełnomocnictwo')).toBeInTheDocument();
    await select('Osoby prawnej lub jednostki organizacyjnej');
    await waitFor(() => expect(section('Dane podmiotu')).toBeInTheDocument());
    expect(section('Adres siedziby')).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'Wybierz, jako kto wnioskujesz' }),
    ).toBeInTheDocument();
    await select('Pełnomocnik');
    await waitFor(() =>
      expect(section('Opłata skarbowa za pełnomonictwo')).toBeInTheDocument(),
    );
    const country = screen.getAllByRole('combobox', { name: /Kraj/ })[0];
    fireEvent.change(country, { target: { value: 'Niemcy' } });
    await waitFor(() =>
      expect(
        document.querySelector('[data-field="wojewodztwo"]'),
      ).not.toBeInTheDocument(),
    );
    expect(
      document.querySelector('[data-field="ulica_zagranica"]'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dalej' }));
    await select('Zaliczyć na poczet przyszłego zobowiązania podatkowego');
    await waitFor(() =>
      expect(
        document.querySelector('[data-field="nazwa_podatku"]'),
      ).toBeInTheDocument(),
    );
    expect(
      document.querySelector('[data-field="numer_rachunku"]'),
    ).not.toBeInTheDocument();
    await select('Zwrócić przelewem na rachunek bankowy');
    await waitFor(() =>
      expect(
        document.querySelector('[data-field="numer_rachunku"]'),
      ).toBeInTheDocument(),
    );
    expect(
      document.querySelector('[data-field="nazwa_podatku"]'),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Wstecz' }));
    expect(section('Dane podmiotu')).toBeInTheDocument();
  });
  it('sanityzuje opisy i zgody, pokazuje błąd warunku i resetuje po przerwaniu', async () => {
    const attack =
      '<script>evil()</script><b onclick="evil()">Bezpieczne</b><a href="javascript:evil()">Link</a>';
    const form = formDefinitionSchema.parse({
      title: 'Test',
      tabs: [
        {
          id: 'a',
          title: 'Krok',
          questions: [
            {
              field: {
                type: 'INFO_SECTION',
                techName: 'info',
                description: attack,
              },
            },
            {
              field: {
                type: 'CONSENT_SECTION',
                techName: 'consent',
                consentSectionConfig: { consents: [{ description: attack }] },
              },
            },
            {
              field: {
                type: 'TEXT_FIELD',
                title: 'Uszkodzone',
                techName: 'bad',
                states: [{ type: 'SHOW', query: '(' }],
              },
            },
            {
              field: {
                type: 'TEXT_FIELD',
                title: 'Zewnętrzne',
                techName: 'external',
                readOnly: true,
                defaultValue: 'MLPZ.name',
                defaultValueType: 'EXTERNAL_SYSTEM',
              },
            },
          ],
        },
      ],
    });
    const { container } = render(<FormRenderer form={form} labels={labels} />);
    await screen.findByText('błędny warunek');
    expect(container.querySelector('script,[onclick],[href]')).toBeNull();
    expect(screen.getByLabelText('Zewnętrzne')).toBeDisabled();
    expect(screen.getByLabelText('Zewnętrzne')).toHaveValue('MLPZ.name');
    fireEvent.click(screen.getByRole('button', { name: labels.cancel }));
    expect(screen.getByText(labels.cancelled)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: labels.restart }));
    await screen.findByText('błędny warunek');
  });
});
it('JSON jest leniwy, kopiuje pełny dokument i obsługuje pustkę', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
  const data = { items: Array.from({ length: 1000 }, (_, i) => i), nil: null };
  const { container, rerender } = render(
    <JsonViewer value={data} labels={jsonCopy} />,
  );
  expect(container.textContent).not.toContain('999');
  fireEvent.click(screen.getByRole('button', { name: 'Rozwiń items' }));
  fireEvent.click(screen.getByRole('button', { name: results.more }));
  expect(container.textContent).toContain('79');
  fireEvent.click(screen.getByRole('button', { name: results.copy }));
  await screen.findByText(results.copied);
  expect(writeText).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  fireEvent.click(screen.getByRole('button', { name: 'Zwiń items' }));
  expect(container.textContent).not.toContain('79');
  rerender(<JsonViewer value={undefined} labels={jsonCopy} />);
  expect(screen.getByText(results.emptyJson)).toBeInTheDocument();
});
it('sortuje i filtruje uwagi; szablon przyjmuje dodatkowe zakładki', () => {
  render(
    <ResultLayout
      title="Wynik"
      navigationLabel="Zakładki"
      active="source"
      tabs={[{ id: 'source', href: '/source', label: 'Źródło' }]}
    >
      <ValidationList
        labels={results}
        issues={[
          { code: 'Z', message: 'Ostrzeżenie', path: 'b', severity: 'warning' },
          { code: 'A', message: 'Błąd', path: 'a', severity: 'error' },
        ]}
      />
    </ResultLayout>,
  );
  expect(screen.getByRole('link', { name: 'Źródło' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Kod' }));
  expect(screen.getAllByRole('row')[1]).toHaveTextContent('A');
  fireEvent.change(screen.getByLabelText(results.filter), {
    target: { value: 'Z' },
  });
  expect(screen.getAllByRole('row')).toHaveLength(2);
  expect(screen.getAllByRole('row')[1]).toHaveTextContent('Z');
});
it('przelicza READ_ONLY, zachowuje osobne odpowiedzi powtórzeń i nawiguje po flow', async () => {
  const form = formDefinitionSchema.parse({
    title: 'Dynamic',
    tabs: [
      {
        id: 'first',
        title: 'Pierwszy',
        questions: [
          {
            field: {
              type: 'CHECKBOX',
              techName: 'choice',
              title: 'Tryb',
              options: [{ id: 'lock', name: 'Blokuj' }],
            },
          },
          {
            field: {
              type: 'TEXT_FIELD',
              techName: 'dynamic',
              title: 'Dynamiczne',
              states: [
                {
                  type: 'READ_ONLY',
                  query:
                    '"Blokuj" in tabs.questions.field[techName="choice"].__userAnswer',
                },
              ],
            },
          },
          {
            field: {
              type: 'REPEATING_SECTION',
              techName: 'repeat',
              title: 'Powtórzenia',
              repeatingSectionGrid: [
                {
                  field: {
                    type: 'TEXT_FIELD',
                    techName: 'item',
                    title: 'Pozycja',
                  },
                },
              ],
            },
          },
        ],
      },
      { id: 'last', title: 'Koniec', type: 'FINISH', questions: [] },
      { id: 'skip', title: 'Pominięty', questions: [] },
    ],
    flow: { links: [{ id: 'link', source: 'first', target: 'last' }] },
  });
  render(<FormRenderer form={form} labels={labels} />);
  await waitFor(() => expect(screen.getByLabelText('Blokuj')).toBeEnabled());
  fireEvent.click(screen.getByLabelText('Blokuj'));
  await waitFor(() =>
    expect(screen.getByLabelText('Dynamiczne')).toBeDisabled(),
  );
  fireEvent.click(screen.getByLabelText('Blokuj'));
  await waitFor(() =>
    expect(screen.getByLabelText('Dynamiczne')).toBeEnabled(),
  );
  fireEvent.change(screen.getByLabelText('Pozycja'), {
    target: { value: 'Pierwsza' },
  });
  fireEvent.click(screen.getByRole('button', { name: labels.add }));
  const items = screen.getAllByLabelText('Pozycja');
  fireEvent.change(items[1], { target: { value: 'Druga' } });
  expect(items[0]).toHaveValue('Pierwsza');
  expect(items[1]).toHaveValue('Druga');
  fireEvent.click(screen.getByRole('button', { name: labels.next }));
  expect(screen.getByRole('heading', { name: 'Koniec' })).toBeInTheDocument();
  expect(screen.getByText(labels.finished)).toBeInTheDocument();
});
