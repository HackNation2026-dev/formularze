import { errorEnvelopeSchema } from './schemas';

export const errorStatuses = {
  FILE_TOO_LARGE: 413,
  TOO_MANY_FILES: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  MIME_MISMATCH: 415,
  INVALID_FILENAME: 400,
  MISSING_FILE: 400,
  UNAUTHORIZED: 401,
  PROCESSING_TIMEOUT: 504,
  MODEL_UNAVAILABLE: 503,
  INVALID_OUTPUT: 500,
  AUTH_MISCONFIGURED: 500,
  INVALID_FORM_DEFINITION: 422,
  INVALID_SAMPLE_VALUES: 422,
} as const;
export type KnownErrorCode = keyof typeof errorStatuses;
export class ApiError extends Error {
  constructor(
    public readonly code: KnownErrorCode | (string & {}),
    public readonly status: number,
    message: string,
    public readonly details: Record<string, unknown> = {},
    public readonly hasEnvelope = true,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  static fromResponse(status: number, body: unknown) {
    const parsed = errorEnvelopeSchema.safeParse(body);
    return parsed.success
      ? new ApiError(
          parsed.data.error.code,
          status,
          parsed.data.error.message,
          parsed.data.error.details,
        )
      : new ApiError('HTTP_ERROR', status, `HTTP ${status}`, {}, false);
  }
}
