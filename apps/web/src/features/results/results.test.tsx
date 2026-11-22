import { NextIntlClientProvider } from 'next-intl';
import { messages } from '@/i18n/messages';
import { ResultView } from '@/design-system/templates/ResultLayout/ResultView';
import { afterEach, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  renderHook,
  waitFor,
  render,
  screen,
  fireEvent,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw/http';
import type { ReactNode } from 'react';
import { server } from '@/mocks/server';
import { formDefinitionSchema } from '@/lib/api/schemas';
import { getResult, putResult, useResult } from './store';
import { parseSampleValues, useResultValidation } from './useResultValidation';
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/results/ui-UNAUTHORIZED/validation',
}));
const form = formDefinitionSchema.parse({ title: 'Test' });
afterEach(cleanup);
function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      {children}
    </QueryClientProvider>
  );
}
it('przechowuje wynik w pamięci i powiadamia subskrybenta', () => {
  const { result } = renderHook(() => useResult('store-test'));
  expect(result.current).toBeUndefined();
  act(() => {
    putResult({
      id: 'store-test',
      form,
      meta: {},
      sourceFile: new File(['a'], 'a.pdf'),
    });
  });
  expect(result.current).toBe(getResult('store-test'));
  expect(result.current?.sourceFile?.name).toBe('a.pdf');
  expect(getResult('missing')).toBeUndefined();
});
it('waliduje JSON wartości, wysyła sample_values i zwraca błędy wartości', async () => {
  expect(parseSampleValues('')).toEqual({});
  for (const invalid of ['[]', 'null', '1', 'bad'])
    expect(() => parseSampleValues(invalid)).toThrow();
  server.use(
    http.post('*/api/v1/forms/validate', async ({ request }) => {
      expect(await request.json()).toMatchObject({
        title: 'Test',
        sample_values: { pesel: '123' },
      });
      return HttpResponse.json({
        valid: false,
        errors: [
          { code: 'X', path: 'tabs', message: 'Test', severity: 'error' },
        ],
        warnings: [],
        sample_errors: [{ techName: 'pesel', value: '123', failed: ['PESEL'] }],
        sample_unknown: ['unknown'],
      });
    }),
  );
  const { result } = renderHook(() => useResultValidation(form), { wrapper });
  act(() => result.current.setSamples('{"pesel":"123"}'));
  act(() => result.current.validate());
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.sample_unknown).toEqual(['unknown']);
  expect(result.current.data?.sample_errors[0].failed).toEqual(['PESEL']);
});
it.each([
  ['INVALID_FORM_DEFINITION', 422, 'invalidForm'],
  ['INVALID_SAMPLE_VALUES', 422, 'invalidValues'],
  ['UNAUTHORIZED', 401, 'unauthorized'],
])('obsługuje %s', async (code, status, key) => {
  server.use(
    http.post('*/api/v1/forms/validate', () =>
      HttpResponse.json(
        { error: { code, message: code, details: {} } },
        { status: Number(status) },
      ),
    ),
  );
  const { result } = renderHook(() => useResultValidation(form), { wrapper });
  act(() => result.current.validate());
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.errorKey).toBe(key);
});
it('odrzuca błędny JSON bez wysyłania żądania', () => {
  const { result } = renderHook(() => useResultValidation(form), { wrapper });
  act(() => result.current.setSamples('[]'));
  act(() => result.current.validate());
  expect(result.current.invalidSamples).toBe(true);
  expect(result.current.isIdle).toBe(true);
});

it.each([
  ['INVALID_FORM_DEFINITION', 422, 'invalidForm'],
  ['INVALID_SAMPLE_VALUES', 422, 'invalidValues'],
  ['UNAUTHORIZED', 401, 'unauthorized'],
] as const)('widok walidacji pokazuje %s', async (code, status, message) => {
  server.use(
    http.post('*/api/v1/forms/validate', () =>
      HttpResponse.json(
        { error: { code, message: code, details: {} } },
        { status },
      ),
    ),
  );
  putResult({ id: 'ui-' + code, form, meta: {} });
  render(
    <NextIntlClientProvider locale="pl" messages={messages.pl}>
      <QueryClientProvider client={new QueryClient()}>
        <ResultView id={'ui-' + code} mode="validation" />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  fireEvent.click(
    screen.getByRole('button', { name: messages.pl.results.validate }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    messages.pl.results[message],
  );
  if (status === 401)
    expect(
      screen.getByRole('link', { name: messages.pl.results.login }),
    ).toHaveAttribute(
      'href',
      expect.stringContaining('/pl/login?reason=401&returnTo='),
    );
});
it('widok pokazuje brak uwag po poprawnej walidacji', async () => {
  putResult({ id: 'ui-valid', form, meta: {} });
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <QueryClientProvider client={new QueryClient()}>
        <ResultView id="ui-valid" mode="validation" />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  fireEvent.click(
    screen.getByRole('button', { name: messages.en.results.validate }),
  );
  expect(
    await screen.findByText(messages.en.results.noIssues),
  ).toBeInTheDocument();
});
