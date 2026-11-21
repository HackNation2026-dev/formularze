import * as pdfjs from "./vendor/pdf.mjs";
pdfjs.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.mjs";
export function connectPdf({ onFile, onBusy, status }) {
  const $ = (id) => document.getElementById(id);
  let pdfDocument = null,
    pdfPage = 1;
  async function renderPdfPage() {
    $("pdf-prev").disabled = true;
    $("pdf-next").disabled = true;
    const page = await pdfDocument.getPage(pdfPage);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = $("pdf-canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.hidden = false;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport })
      .promise;
    $("pdf-position").textContent =
      `PDF: strona ${pdfPage} z ${pdfDocument.numPages}`;
    const content = await page.getTextContent();
    $("pdf-text").textContent = content.items
      .map((item) => item.str + (item.hasEOL ? "\n" : " "))
      .join("");
    $("pdf-prev").disabled = pdfPage === 1;
    $("pdf-next").disabled = pdfPage === pdfDocument.numPages;
  }
  $("pdf-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    onBusy(true);
    try {
      if (file.size > 25 * 1024 * 1024)
        throw new Error("PDF przekracza limit podglądu 25 MB.");
      const data = new Uint8Array(await file.arrayBuffer());
      if (new TextDecoder().decode(data.slice(0, 5)) !== "%PDF-")
        throw new Error("To nie jest plik PDF.");
      const next = await pdfjs.getDocument({
        data,
        isEvalSupported: false,
        enableXfa: false,
      }).promise;
      await pdfDocument?.destroy();
      pdfDocument = next;
      onFile(file);
      pdfPage = 1;
      $("pdf-name").textContent = file.name;
      await renderPdfPage();
    } catch (e) {
      status(`Błąd PDF: ${e.message}`);
    } finally {
      onBusy(false);
    }
  });
  for (const [id, change] of [
    ["pdf-prev", -1],
    ["pdf-next", 1],
  ])
    $(id).addEventListener("click", async () => {
      try {
        pdfPage += change;
        await renderPdfPage();
      } catch (e) {
        status(`Błąd PDF: ${e.message}`);
      }
    });
}
