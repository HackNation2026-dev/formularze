import { formDefinitionSchema } from '@/lib/api';
import { queueStore } from '@/features/upload/store';
export async function openJson(file: File) {
  const form = formDefinitionSchema.parse(JSON.parse(await file.text()));
  return queueStore.addLocal(file, {
    form,
    metadata: {
      extractor: null,
      detectedType: 'application/json',
      processingTimeMs: null,
      warnings: null,
    },
  });
}
