import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';

const source = new URL(
  '../../../data/input/02_przyklady_json/',
  import.meta.url,
);
const target = new URL('../src/mocks/fixtures/', import.meta.url);
await mkdir(target, { recursive: true });
for (const name of await readdir(target))
  if (name.endsWith('.json')) await rm(new URL(name, target));
for (const name of await readdir(source))
  if (name.endsWith('.json'))
    await copyFile(new URL(name, source), new URL(name, target));
