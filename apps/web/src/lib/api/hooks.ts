'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from './client';
import type { FormDefinition } from './schemas';

export const useHealth = () =>
  useQuery({ queryKey: ['health'], queryFn: () => api.health() });
export const useReady = () =>
  useQuery({ queryKey: ['ready'], queryFn: () => api.ready() });
export const useFormats = () =>
  useQuery({ queryKey: ['formats'], queryFn: () => api.formats() });
export const useAnalyze = () =>
  useMutation({ mutationFn: (file: File) => api.analyze(file) });
export const useValidate = () =>
  useMutation({
    mutationFn: ({
      form,
      sampleValues,
    }: {
      form: FormDefinition;
      sampleValues?: Record<string, unknown>;
    }) => api.validate(form, sampleValues),
  });
