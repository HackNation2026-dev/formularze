'use client';
import { useState } from 'react';
import { useValidate } from '@/lib/api/hooks';
import { ApiError } from '@/lib/api/errors';
import type { FormDefinition } from '@/lib/api/schemas';
export function parseSampleValues(text: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(text.trim() || '{}');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('INVALID_SAMPLE_VALUES');
  return parsed as Record<string, unknown>;
}
export function useResultValidation(form: FormDefinition) {
  const mutation = useValidate();
  const [samples, setSamples] = useState('{}');
  const [invalidSamples, setInvalidSamples] = useState(false);
  const error = mutation.error;
  const errorKey =
    error instanceof ApiError
      ? error.status === 401
        ? 'unauthorized'
        : error.code === 'INVALID_FORM_DEFINITION'
          ? 'invalidForm'
          : error.code === 'INVALID_SAMPLE_VALUES'
            ? 'invalidValues'
            : 'apiError'
      : 'apiError';
  function validate() {
    let sampleValues: Record<string, unknown>;
    try {
      sampleValues = parseSampleValues(samples);
      setInvalidSamples(false);
    } catch {
      setInvalidSamples(true);
      return;
    }
    mutation.mutate({ form, sampleValues });
  }
  return {
    ...mutation,
    samples,
    setSamples,
    invalidSamples,
    validate,
    errorKey,
    statusCode: error instanceof ApiError ? error.status : 0,
  };
}
