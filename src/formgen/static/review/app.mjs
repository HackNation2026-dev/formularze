import { renderForm, element } from "./render.mjs";
import { checkShape, fields, digest } from "./configuration.mjs";
import { api } from "./api.mjs";
import { connectPdf } from "./pdf.mjs";
const $ = (id) => document.getElementById(id);
let configurationSha256 = "",
  annotations = [],
  noteTarget = null,
  provenance = null,
  loadVersion = 0;
let config = null,
  views = new Map(),
  answers = new Map();
let simulation = false,
  conditionWorker = null,
  conditionTimer = null,
  conditionResults = {};
let pdfFile = null;
connectPdf({
  onFile: (file) => {
    pdfFile = file;
  },
  onBusy: setBusy,
  status,
});
function status(message) {
  $("status").textContent = message;
}
function initialAnswers(value) {
  return new Map(
    fields(value).map(({ key, field }) => [
      key,
      field.defaultValueType === "EXTERNAL_SYSTEM"
        ? ""
        : structuredClone(
            field.defaultValue ??
              (["RADIO", "SELECT", "CHECKBOX"].includes(field.type) ? [] : ""),
          ),
    ]),
  );
}
async function loadConfig(value, origin) {
  const version = ++loadVersion;
  checkShape(value);
  const hash = await digest(value);
  if (version !== loadVersion) return;
  configurationSha256 = hash;
  annotations = [];
  provenance = origin;
  $("notes").replaceChildren();
  $("note-form").hidden = true;
  noteTarget = null;
  $("digest").textContent = `SHA-256 konfiguracji: ${hash}`;
  $("validation").textContent = "Walidacja struktury: nie uruchomiono.";
  for (const id of ["export-json", "export-report", "missing", "validate"])
    $(id).disabled = false;
  config = value;
  answers = initialAnswers(config);
  views = renderForm(config, answers, evaluateConditions, openNote);
  conditionResults = {};
  evaluateConditions();
  $("provenance").textContent =
    typeof origin === "string" ? origin : origin.label;
  status(
    `Wczytano ${fields(config).length} elementów. Kompletność treści wymaga porównania ze źródłem.`,
  );
}
$("json-file").addEventListener("change", async (event) => {
  setBusy(true);
  try {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024)
      throw new Error("JSON przekracza limit 10 MB.");
    await loadConfig(
      JSON.parse(await file.text()),
      `Plik lokalny: ${file.name}. Pochodzenie AI niepotwierdzone.`,
    );
  } catch (e) {
    status(`Błąd JSON: ${e.message}`);
  } finally {
    setBusy(false);
  }
});
function applyConditions() {
  for (const { key, field } of fields(config)) {
    const view = views.get(key),
      result = conditionResults[key];
    view.box.hidden = simulation && result?.show === false;
    view.controls.forEach(
      (c) => (c.disabled = !simulation || !result || result.readOnly),
    );
    view.stateInfo.textContent =
      result?.show === false
        ? "Ukryte w symulacji (warunek pola lub sekcji)."
        : field.states?.length
          ? "Warunek: widoczne w symulacji."
          : "";
    view.error.hidden = !result?.errors.length;
    view.error.textContent = result?.errors.length
      ? `Błąd warunku: ${result.errors.join("; ")}`
      : "";
  }
}
function evaluateConditions() {
  conditionWorker?.terminate();
  clearTimeout(conditionTimer);
  if (!config) return;
  const worker = new Worker("./conditions-worker.js", { type: "module" });
  conditionWorker = worker;
  $("condition-status").textContent = "Przeliczanie warunków…";
  applyConditions();
  function finish(results, message) {
    if (conditionWorker !== worker) return;
    clearTimeout(conditionTimer);
    worker.terminate();
    conditionWorker = null;
    conditionResults = results;
    applyConditions();
    $("condition-status").textContent = message;
  }
  function failed(message) {
    const results = Object.fromEntries(
      fields(config).map(({ key }) => [
        key,
        { show: true, readOnly: true, errors: [message] },
      ]),
    );
    finish(results, `Błąd warunków: ${message}`);
  }
  worker.onmessage = ({ data }) => {
    const errors = Object.entries(data).filter(
      ([, value]) => value.errors.length,
    );
    finish(
      data,
      errors.length
        ? `Błędy warunków (${errors.length}): ${errors.map(([key, value]) => `${views.get(key).box.dataset.tech}: ${value.errors.join("; ")}`).join(" | ")}`
        : "Warunki przeliczone.",
    );
  };
  worker.onerror = () =>
    failed("Nie udało się uruchomić lokalnego silnika JSONata.");
  conditionTimer = setTimeout(
    () => failed("Przekroczono limit czasu 2 s; sprawdź wyrażenia."),
    2000,
  );
  worker.postMessage({ config, answers: Object.fromEntries(answers) });
}
function setMode(value) {
  simulation = value;
  $("review-mode").setAttribute("aria-pressed", String(!value));
  $("simulate-mode").setAttribute("aria-pressed", String(value));
  $("mode-help").textContent = value
    ? "Symulacja: zmieniaj odpowiedzi, także po przejściu na dalszą stronę. To dane przykładowe; rejestry nie są podłączone."
    : "Przegląd pokazuje także pola ukrywane warunkowo. Odpowiedzi zmienisz w symulacji.";
  if (config) applyConditions();
}
$("review-mode").addEventListener("click", () => setMode(false));
$("simulate-mode").addEventListener("click", () => setMode(true));

function download(name, value) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2) + "\n"], {
      type: "application/json",
    }),
  );
  const anchor = element("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function openNote(field) {
  noteTarget = field;
  $("note-target").textContent = field
    ? `Uwaga do pola: ${field.title} (${field.techName})`
    : "Brakująca informacja — bez odpowiednika w konfiguracji";
  $("note-form").reset();
  $("note-form").hidden = false;
  $("note-location").focus();
}
$("missing").addEventListener("click", () => openNote(null));
$("cancel-note").addEventListener("click", () => {
  $("note-form").hidden = true;
  $("missing").focus();
});
$("note-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const value = $("note-text").value.trim();
  if (!value) return;
  const annotation = {
    kind: noteTarget ? "field" : "missing",
    field: noteTarget,
    location: $("note-location").value.trim(),
    text: value,
  };
  annotations.push(annotation);
  $("notes").append(
    element(
      "li",
      `${noteTarget ? noteTarget.title + " (" + noteTarget.techName + ")" : "Brakująca informacja"} — ${annotation.location}\n${annotation.text}`,
    ),
  );
  $("note-form").hidden = true;
  $("missing").focus();
  status(`Zapisano uwagę. Raport zawiera ${annotations.length} uwag.`);
});
$("export-json").addEventListener("click", () =>
  download(`konfiguracja-${configurationSha256.slice(0, 12)}.json`, config),
);
$("export-report").addEventListener("click", () =>
  download(`raport-${configurationSha256.slice(0, 12)}.json`, {
    reportVersion: 1,
    configurationSha256,
    hashMethod:
      "SHA-256 of UTF-8 JSON with sorted object keys, compact separators; array order preserved",
    configurationTitle: config.title,
    provenance,
    sourcePdfName: pdfFile?.name ?? null,
    createdAt: new Date().toISOString(),
    annotations,
  }),
);

function setBusy(busy) {
  $("json-file").disabled = busy;
  $("pdf-file").disabled = busy;
  $("analyze").disabled = busy || !pdfFile;
  $("validate").disabled = busy || !config;
}
$("analyze").addEventListener("click", async () => {
  if (!pdfFile) return;
  setBusy(true);
  status(
    "Przetwarzanie PDF przez API… Poczekaj na wynik. Dotychczasowa konfiguracja pozostaje widoczna.",
  );
  try {
    const body = new FormData();
    body.append("file", pdfFile, pdfFile.name);
    const { value, headers } = await api(
      "analyze",
      body,
      $("token").value.trim(),
    );
    const extractor = headers.get("X-Extractor") ?? "";
    const label =
      extractor === "LlmExtractor"
        ? "Wynik AI"
        : extractor === "HeuristicExtractor"
          ? "Tryb zastępczy (heurystyka, bez AI)"
          : extractor === "StubExtractor"
            ? "Tryb testowy (stub, bez AI)"
            : "Nieznane pochodzenie — API nie potwierdza AI";
    const processingTimeMs = headers.get("X-Processing-Time-Ms");
    const warnings = headers.get("X-Warnings");
    await loadConfig(value, {
      kind: "api",
      extractor,
      processingTimeMs,
      warnings,
      label: `${label} · ${extractor || "brak X-Extractor"} · czas: ${processingTimeMs ?? "?"} ms · ostrzeżenia: ${warnings ?? "?"}`,
    });
    setMode(false);
    status(
      `Zakończono: ${label}. Kompletność treści i warunki wymagają osobnego przeglądu.`,
    );
  } catch (e) {
    status(
      `Błąd generacji: ${e.message}. Nie zastąpiono dotychczasowej konfiguracji.`,
    );
  } finally {
    setBusy(false);
  }
});
$("validate").addEventListener("click", async () => {
  if (!config) return;
  setBusy(true);
  $("validation").textContent = "Walidacja struktury w toku…";
  try {
    const { value } = await api(
      "validate",
      config,
      $("token").value.trim(),
      true,
    );
    if (
      typeof value.valid !== "boolean" ||
      !Array.isArray(value.errors) ||
      !Array.isArray(value.warnings)
    )
      throw new Error("Nieprawidłowa odpowiedź walidatora.");
    $("validation").textContent =
      `${value.valid ? "Struktura poprawna" : "Błędy techniczne konfiguracji"}. Walidacja nie potwierdza kompletności treści ani poprawności zachowania warunków.\n${[...value.errors, ...value.warnings].map((item) => `${item.code}: ${item.message} ${item.path ?? ""}`).join("\n")}`;
  } catch (e) {
    $("validation").textContent = `Błąd walidacji: ${e.message}`;
  } finally {
    setBusy(false);
  }
});
