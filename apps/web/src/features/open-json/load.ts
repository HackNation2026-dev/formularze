import { formDefinitionSchema } from '@/lib/api';
import { putResult } from '@/features/results';
export async function openJson(file: File) {
  const form = formDefinitionSchema.parse(JSON.parse(await file.text()));
  const id = `local-${crypto.randomUUID()}`;
  putResult({ id, form, meta: {}, sourceFile: file, source: 'local' });
  return id;
}
