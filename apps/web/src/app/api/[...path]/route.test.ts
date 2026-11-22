// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const backend = 'http://127.0.0.1:8001';

describe('proxy /api w Next (route handler)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('przekazuje ścieżkę, metodę, nagłówki i ciało do API_INTERNAL_URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"ok":true}', {
        status: 200,
        headers: { 'X-Extractor': 'LlmExtractor' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const request = new Request('http://localhost:3000/api/v1/forms/analyze?x=1', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=x', authorization: 'Bearer t' },
      body: 'file=dane',
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Extractor')).toBe('LlmExtractor');
    expect(await response.text()).toBe('{"ok":true}');
    const [target, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(target).toBe(`${backend}/api/v1/forms/analyze?x=1`);
    expect(init.method).toBe('POST');
    const headers = init.headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer t');
    expect(headers.get('host')).toBeNull();
  });

  it('błąd backendu przechodzi bez zmian (status i koperta)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{"error":{"code":"NETWORK_ERROR"}}', {
          status: 503,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const response = await POST(
      new Request('http://localhost:3000/api/v1/forms/analyze', { method: 'POST' }),
    );
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('NETWORK_ERROR');
  });
});
