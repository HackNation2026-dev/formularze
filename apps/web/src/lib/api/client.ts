import { z } from 'zod';
import { ApiError } from './errors';
import { recordActivity } from './activity';
import { tokenStore } from './token-store';
import {
  formDefinitionSchema,
  healthSchema,
  readySchema,
  formatsSchema,
  batchSchema,
  validationSchema,
  type FormDefinition,
  type AnalyzeResult,
} from './schemas';

export class ApiClient {
  constructor(
    private readonly base = process.env.NEXT_PUBLIC_API_BASE ?? '',
    private readonly fetcher: typeof fetch = (...args) => fetch(...args),
  ) {}
  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    init: RequestInit = {},
    allowUnavailable = false,
  ): Promise<{ data: T; headers: Headers }> {
    const headers = new Headers(init.headers);
    const token = tokenStore.get();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    let response: Response;
    const startedAt = performance.now();
    try {
      response = await this.fetcher(`${this.base.replace(/\/$/, '')}${path}`, {
        ...init,
        headers,
      });
    } catch (cause) {
      recordActivity({
        path,
        method: init.method ?? 'GET',
        status: 0,
        ms: performance.now() - startedAt,
      });
      if (cause instanceof Error && cause.name === 'AbortError') throw cause;
      throw new ApiError('NETWORK_ERROR', 0, 'NETWORK_ERROR', {}, false);
    }
    recordActivity({
      path,
      method: init.method ?? 'GET',
      status: response.status,
      ms: performance.now() - startedAt,
    });
    const body: unknown = await response.json().catch(() => null);
    if (
      !response.ok &&
      !(
        allowUnavailable &&
        response.status === 503 &&
        readySchema.safeParse(body).success
      )
    )
      throw ApiError.fromResponse(response.status, body);
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      throw new ApiError(
        'INVALID_RESPONSE',
        response.status,
        'INVALID_RESPONSE',
        { issues: parsed.error.issues },
        false,
      );
    return { data: parsed.data, headers: response.headers };
  }
  async health() {
    return (await this.request('/health', healthSchema)).data;
  }
  async ready() {
    return (await this.request('/ready', readySchema, {}, true)).data;
  }
  async formats() {
    return (await this.request('/api/v1/formats', formatsSchema)).data;
  }
  async analyze(file: File, signal?: AbortSignal): Promise<AnalyzeResult> {
    const body = new FormData();
    body.append('file', file);
    const { data, headers } = await this.request(
      '/api/v1/forms/analyze',
      formDefinitionSchema,
      { method: 'POST', body, signal },
    );
    const numeric = (name: string) => {
      const value = headers.get(name);
      return value !== null && Number.isFinite(Number(value))
        ? Number(value)
        : null;
    };
    return {
      form: data,
      metadata: {
        processingTimeMs: numeric('X-Processing-Time-Ms'),
        detectedType: headers.get('X-Detected-Type'),
        warnings: numeric('X-Warnings'),
        extractor: headers.get('X-Extractor'),
        partialResult: headers.get('X-Partial-Result') === 'true',
        partialReasons: (headers.get('X-Partial-Reasons') ?? '')
          .split(/[,;]\s*/)
          .map((reason) => reason.trim())
          .filter(Boolean),
      },
    };
  }
  async analyzeBatch(files: File[]) {
    const body = new FormData();
    files.forEach((file) => body.append('files', file));
    return (
      await this.request('/api/v1/forms/analyze-batch', batchSchema, {
        method: 'POST',
        body,
      })
    ).data;
  }
  async validate(
    form: FormDefinition,
    sampleValues: Record<string, unknown> = {},
  ) {
    return (
      await this.request('/api/v1/forms/validate', validationSchema, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, sample_values: sampleValues }),
      })
    ).data;
  }
}
export const api = new ApiClient();
