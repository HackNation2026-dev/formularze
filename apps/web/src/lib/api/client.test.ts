// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw/http';
import { ApiClient } from './client';
import { ApiError, errorStatuses } from './errors';
import { tokenStore } from './token-store';
import { server } from '@/mocks/server';
import { setMockScenario } from '@/mocks/scenarios';

const client = new ApiClient('http://localhost');
const file = (name = 'formularz.pdf') =>
  new File(['%PDF-1.7'], name, { type: 'application/pdf' });
describe('klient API', () => {
  it.each(Object.entries(errorStatuses))(
    '%s jest ApiError ze statusem %i',
    async (code, status) => {
      server.use(
        http.post('*/api/v1/forms/analyze', () =>
          HttpResponse.json(
            { error: { code, message: 'Opis błędu', details: { test: true } } },
            { status },
          ),
        ),
      );
      await expect(client.analyze(file())).rejects.toMatchObject({
        name: 'ApiError',
        code,
        status,
        message: 'Opis błędu',
        details: { test: true },
        hasEnvelope: true,
      });
    },
  );
  it.each([
    { status: 422, body: { detail: [] } },
    { status: 500, body: null },
  ])('odpowiedź bez koperty: $status', async ({ status, body }) => {
    server.use(
      http.get('*/health', () =>
        body
          ? HttpResponse.json(body, { status })
          : HttpResponse.text('Internal Server Error', { status }),
      ),
    );
    await expect(client.health()).rejects.toMatchObject({
      name: 'ApiError',
      status,
      code: 'HTTP_ERROR',
      message: `HTTP ${status}`,
      hasEnvelope: false,
    });
  });
  it('wysyła token Bearer, nie ustawia ręcznie granicy multipart i odczytuje nagłówki', async () => {
    const token = vi.spyOn(tokenStore, 'get').mockReturnValue('token-testowy');
    server.use(
      http.post('*/api/v1/forms/analyze', async ({ request }) => {
        expect(request.headers.get('Authorization')).toBe(
          'Bearer token-testowy',
        );
        expect(request.headers.get('Content-Type')).toContain(
          'multipart/form-data; boundary=',
        );
        expect((await request.formData()).get('file')).toBeTruthy();
        return HttpResponse.json(
          { title: 'Test', tabs: [], flow: { links: [] } },
          {
            headers: {
              'X-Processing-Time-Ms': '42',
              'X-Detected-Type': 'pdf;score=1.000',
              'X-Warnings': '2',
              'X-Extractor': 'HeuristicExtractor',
            },
          },
        );
      }),
    );
    expect((await client.analyze(file())).metadata).toEqual({
      processingTimeMs: 42,
      detectedType: 'pdf;score=1.000',
      warnings: 2,
      extractor: 'HeuristicExtractor',
    });
    token.mockRestore();
  });
  it('brak nagłówków nie jest zerowym czasem', async () => {
    server.use(
      http.post('*/api/v1/forms/analyze', () =>
        HttpResponse.json({ title: 'Test' }),
      ),
    );
    expect((await client.analyze(file())).metadata.processingTimeMs).toBeNull();
  });
  it('odczytuje /ready także przy 503', async () => {
    setMockScenario('MODEL_UNAVAILABLE');
    expect((await client.ready()).status).toBe('unavailable');
  });
  it('odrzuca nieprawidłową odpowiedź 200', async () => {
    server.use(
      http.get('*/health', () => HttpResponse.json({ status: 'uszkodzony' })),
    );
    await expect(client.health()).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      status: 200,
    });
  });
  it('awaria sieci staje się ApiError', async () => {
    const broken = new ApiClient(
      '',
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')),
    );
    await expect(broken.health()).rejects.toBeInstanceOf(ApiError);
  });
  it('przerwanie żądania zachowuje AbortError', async () => {
    const cancelled = new ApiClient(
      '',
      vi
        .fn<typeof fetch>()
        .mockRejectedValue(new DOMException('Przerwano', 'AbortError')),
    );
    await expect(cancelled.health()).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
  it('walidacja obsługuje sample_errors oraz sample_unknown', async () => {
    server.use(
      http.post('*/api/v1/forms/validate', async ({ request }) => {
        expect(await request.json()).toMatchObject({
          sample_values: { pesel: '123' },
        });
        return HttpResponse.json({
          valid: true,
          errors: [],
          warnings: [],
          sample_errors: [
            { techName: 'pesel', value: '123', failed: ['PESEL'] },
          ],
          sample_unknown: ['inne'],
        });
      }),
    );
    const result = await client.validate(
      { title: 'Test', tabs: [], flow: { links: [] } },
      { pesel: '123' },
    );
    expect(result.sample_errors[0].failed).toEqual(['PESEL']);
    expect(result.sample_unknown).toEqual(['inne']);
  });
});
