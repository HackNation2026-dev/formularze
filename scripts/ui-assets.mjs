import { mkdir, copyFile, readFile } from "node:fs/promises";
const dest = "src/formgen/static/review/vendor";
await mkdir(dest, { recursive: true });
for (const [source, target] of [
  ["pdfjs-dist/build/pdf.mjs", "pdf.mjs"],
  ["pdfjs-dist/build/pdf.worker.mjs", "pdf.worker.mjs"],
  ["pdfjs-dist/LICENSE", "pdfjs-LICENSE"],
  ["jsonata/jsonata.min.js", "jsonata.min.js"],
  ["jsonata/LICENSE", "jsonata-LICENSE"],
])
  if (process.argv.includes("--check")) {
    const expected = await readFile(`node_modules/${source}`);
    const actual = await readFile(`${dest}/${target}`).catch(() => null);
    if (!actual || !actual.equals(expected))
      throw new Error(
        `Brakujące lub nieaktualne zasoby UI: ${target}. Uruchom npm run ui:assets przed testowaniem i pakowaniem.`,
      );
  } else await copyFile(`node_modules/${source}`, `${dest}/${target}`);
