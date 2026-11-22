import { z } from 'zod';

export const fieldTypes = [
  'SECTION',
  'REPEATING_SECTION',
  'TEXT_FIELD',
  'TEXTAREA',
  'NUMBER',
  'CHECKBOX',
  'RADIO',
  'SELECT',
  'DATEPICKER',
  'FILE_UPLOADER',
  'CONSENT_SECTION',
  'TEXT_BLOCK',
  'INFO_SECTION',
] as const;
export const validators = [
  'REQUIRED',
  'EMAIL',
  'PESEL',
  'NIP',
  'REGON',
  'ZIP_CODE',
  'EPUAP',
  'ADE',
  'SERIAL_NUMBER_ID_CARD',
] as const;
export const optionSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    techName: z.string().nullable().optional(),
  })
  .passthrough();
export const stateSchema = z
  .object({ type: z.enum(['SHOW', 'READ_ONLY']), query: z.string() })
  .passthrough();
export const consentSchema = z
  .object({
    description: z.string(),
    required: z.boolean().nullable().optional(),
  })
  .passthrough();
export const consentConfigSchema = z
  .object({
    consents: z.array(consentSchema).default([]),
    required: z.boolean().nullable().optional(),
    files: z.array(z.unknown()).default([]),
  })
  .passthrough();

export interface Field {
  [key: string]: unknown;
  id: string;
  type: (typeof fieldTypes)[number];
  techName: string;
  title: string;
  description: string;
  options: z.infer<typeof optionSchema>[];
  validation: (typeof validators)[number][];
  readOnly: boolean;
  repeatingSectionGrid: Question[];
  states: z.infer<typeof stateSchema>[];
  questionOrder: number;
  tooltipMessage: string;
  dictionaryName?: string | null;
  defaultValue?: string | string[] | null;
  defaultValueType?: 'EXTERNAL_SYSTEM' | null;
  searchEnabled?: boolean | null;
  multiLevelTree?: boolean | null;
  selectAllEnabled?: boolean | null;
  consentSectionConfig?: z.infer<typeof consentConfigSchema> | null;
}
export interface Question {
  [key: string]: unknown;
  x: number;
  y: number;
  rows: number;
  cols: number;
  field: Field;
  minItemRows?: number | null;
}

export const fieldSchema: z.ZodType<Field> = z.lazy(() =>
  z
    .object({
      id: z.string().default(() => crypto.randomUUID()),
      type: z.enum(fieldTypes),
      techName: z.string(),
      title: z.string().default(''),
      description: z.string().default(''),
      options: z.array(optionSchema).default([]),
      validation: z.preprocess(
        (value) =>
          value === null ||
          (typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value) &&
            Object.keys(value).length === 0)
            ? []
            : value,
        z.array(z.enum(validators)).default([]),
      ),
      readOnly: z.boolean().default(false),
      repeatingSectionGrid: z.array(questionSchema).default([]),
      states: z.array(stateSchema).default([]),
      questionOrder: z.number().int().default(0),
      tooltipMessage: z.string().default(''),
      dictionaryName: z.string().nullable().optional(),
      defaultValue: z
        .union([z.string(), z.array(z.string())])
        .nullable()
        .optional(),
      defaultValueType: z.literal('EXTERNAL_SYSTEM').nullable().optional(),
      searchEnabled: z.boolean().nullable().optional(),
      multiLevelTree: z.boolean().nullable().optional(),
      selectAllEnabled: z.boolean().nullable().optional(),
      consentSectionConfig: consentConfigSchema.nullable().optional(),
    })
    .passthrough(),
);
export const questionSchema: z.ZodType<Question> = z.lazy(() =>
  z
    .object({
      x: z.number().int().default(0),
      y: z.number().int().default(0),
      rows: z.number().int().default(1),
      cols: z.number().int().default(3),
      field: fieldSchema,
      minItemRows: z.number().int().nullable().optional(),
    })
    .passthrough(),
);
export const formDefinitionSchema = z
  .object({
    title: z.string(),
    tabs: z
      .array(
        z
          .object({
            id: z.string().default(() => crypto.randomUUID()),
            title: z.string(),
            type: z.enum(['MAIN', 'FINISH']).default('MAIN'),
            questions: z.array(questionSchema).default([]),
          })
          .passthrough(),
      )
      .default([]),
    flow: z
      .object({
        links: z
          .array(
            z
              .object({
                id: z.string().default(() => crypto.randomUUID()),
                source: z.string(),
                target: z.string(),
              })
              .passthrough(),
          )
          .default([]),
      })
      .passthrough()
      .default({ links: [] }),
  })
  .passthrough();
export type FormDefinition = z.infer<typeof formDefinitionSchema>;

export const healthSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
});
export const readySchema = z.object({
  status: z.enum(['ok', 'degraded', 'unavailable']),
  extractor: z.string(),
  llm: z.string(),
  ocr: z.string(),
  llm_alive: z.boolean().optional(),
});
export const formatsSchema = z.object({
  extensions: z.array(z.string()),
  max_upload_size_mb: z.number().positive(),
});
export const errorDetailSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).default({}),
  })
  .passthrough();
export const errorEnvelopeSchema = z.object({ error: errorDetailSchema });
export const metadataSchema = z.object({
  processing_time_ms: z.number(),
  detected_type: z.string(),
  detected_score: z.number(),
  warnings: z.number().int(),
  extractor: z.string(),
});
export const batchSchema = z.object({
  results: z.array(
    z.union([
      metadataSchema.extend({
        filename: z.string().nullable(),
        status: z.literal(200),
        form: formDefinitionSchema,
      }),
      z.object({
        filename: z.string().nullable(),
        status: z.number(),
        error: errorDetailSchema,
      }),
    ]),
  ),
  ok: z.number().int(),
  failed: z.number().int(),
});
export const violationSchema = z.object({
  code: z.string(),
  severity: z.enum(['error', 'warning']),
  message: z.string(),
  path: z.string(),
});
export const sampleErrorSchema = z.object({
  techName: z.string(),
  value: z.unknown(),
  failed: z.array(z.enum(validators)),
});
export const validationSchema = z.object({
  valid: z.boolean(),
  errors: z.array(violationSchema),
  warnings: z.array(violationSchema),
  sample_errors: z.array(sampleErrorSchema),
  sample_unknown: z.array(z.string()),
});
export type Health = z.infer<typeof healthSchema>;
export type Ready = z.infer<typeof readySchema>;
export type Formats = z.infer<typeof formatsSchema>;
export type BatchResult = z.infer<typeof batchSchema>;
export type ValidationResult = z.infer<typeof validationSchema>;
export interface AnalyzeResult {
  form: FormDefinition;
  metadata: {
    processingTimeMs: number | null;
    detectedType: string | null;
    warnings: number | null;
    extractor: string | null;
    partialResult: boolean;
    partialReasons: string[];
  };
}
