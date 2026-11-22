import { copyFile, mkdir } from 'node:fs/promises';

const target = new URL('../src/design-system/tokens/', import.meta.url);
await mkdir(target, { recursive: true });
await copyFile(
  new URL('../../../design/tokens.css', import.meta.url),
  new URL('tokens.generated.css', target),
);
