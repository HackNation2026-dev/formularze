const { test, expect } = require("@playwright/test");
const path = require("node:path");
const reference = path.resolve(
  "data/input/02_przyklady_json/05_nadplata_podatku.json",
);
const pdf = path.resolve(
  "data/input/01_przyklady_formularze/05_nadplata_podatku/Wniosek o stwierdzenie nadpłaty podatku.PDF",
);

async function openReview(page) {
  await page.goto("/review/");
  await expect(page.getByLabel("Konfiguracja JSON")).toBeEnabled();
}

async function loadReference(page) {
  await openReview(page);
  await page.getByLabel("Konfiguracja JSON").setInputFiles(reference);
  await expect(
    page.getByRole("heading", {
      name: "Wniosek o stwierdzenie nadpłaty podatku",
      exact: true,
    }),
  ).toBeVisible();
}

test("review opens the source PDF beside every reference field, including conditional fields", async ({
  page,
}) => {
  await loadReference(page);
  await page.getByLabel("PDF źródłowy").setInputFiles(pdf);
  await expect(page.getByText("PDF: strona 1 z 1")).toBeVisible();
  await expect(page.locator("#pdf-canvas")).toBeVisible();
  await expect(page.locator("[data-field]")).toHaveCount(73);
  await expect(page.locator('[data-tech="dane_innej_osoby"]')).toBeVisible();
  await expect(page.locator('[data-tech="numer_rachunku"]')).toBeVisible();
  await expect(
    page.getByText("Nieobsługiwany typ", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Rejestr niepodłączony", { exact: false }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/reference-desktop.png",
  });
});

test("simulation recalculates person and settlement variants after changing an earlier choice again", async ({
  page,
}) => {
  await loadReference(page);
  await page.getByRole("button", { name: "Symulacja", exact: true }).click();
  const other = page.locator('[data-tech="dane_innej_osoby"]');
  await page.getByRole("radio", { name: "Innej osoby", exact: true }).check();
  await expect(other).toBeVisible();
  await page.getByRole("radio", { name: "Swoim", exact: true }).check();
  await expect(other).toBeHidden();
  await page.getByRole("radio", { name: "Innej osoby", exact: true }).check();
  await expect(other).toBeVisible();
  await page
    .getByRole("radio", {
      name: "Osoby prawnej lub jednostki organizacyjnej",
      exact: true,
    })
    .check();
  await page.getByRole("radio", { name: "Reprezentant", exact: true }).check();
  await expect(
    page.locator('[data-tech="potwierdzenie_ze_jestes_reprezentantem"]'),
  ).toBeVisible();
  await expect(page.locator('[data-tech="pelnomocnictwo"]')).toBeHidden();
  await page.getByRole("radio", { name: "Pełnomocnik", exact: true }).check();
  await expect(
    page.locator('[data-tech="potwierdzenie_ze_jestes_reprezentantem"]'),
  ).toBeHidden();
  await expect(page.locator('[data-tech="pelnomocnictwo"]')).toBeVisible();
  for (const option of [
    "Zwrócić przelewem na rachunek bankowy",
    "Zaliczyć na poczet przyszłego zobowiązania podatkowego",
    "Zwrócić przelewem na rachunek bankowy",
  ]) {
    await page.getByRole("radio", { name: option, exact: true }).check();
    const bank = page.locator('[data-tech="numer_rachunku"]');
    if (option.startsWith("Zwrócić")) await expect(bank).toBeVisible();
    else await expect(bank).toBeHidden();
  }
  await page.getByRole("button", { name: "Przegląd wszystkich pól" }).click();
  await expect(page.locator('[data-tech="nazwa_podatku"]')).toBeVisible();
  await expect(other).toBeVisible();
});

const fs = require("node:fs/promises");
async function downloadJson(page, button) {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: button, exact: true }).click();
  return JSON.parse(await fs.readFile(await (await download).path(), "utf8"));
}

test("field notes and missing information export against the config hash, never contaminating COI JSON or a new result", async ({
  page,
}) => {
  await loadReference(page);
  await page
    .locator('[data-tech="kwota"]')
    .getByRole("button", { name: "Dodaj uwagę: Kwota", exact: true })
    .click();
  await page
    .getByLabel("Treść uwagi", { exact: true })
    .fill("Sprawdzić walutę kwoty.");
  await page.getByRole("button", { name: "Zapisz uwagę", exact: true }).click();
  await page
    .getByRole("button", { name: "Zgłoś brakującą informację" })
    .click();
  await page
    .getByLabel("Miejsce w PDF lub opis informacji")
    .fill("Strona 1, uzasadnienie");
  await page
    .getByLabel("Treść uwagi", { exact: true })
    .fill("Brak okresu podatkowego.");
  await page.getByRole("button", { name: "Zapisz uwagę", exact: true }).click();
  await page.getByRole("button", { name: "Symulacja", exact: true }).click();
  await page.getByRole("radio", { name: "Innej osoby", exact: true }).check();
  const clean = await downloadJson(page, "Pobierz czysty JSON");
  expect(clean).toEqual(JSON.parse(await fs.readFile(reference, "utf8")));
  const report = await downloadJson(page, "Pobierz raport uwag");
  expect(report.configurationSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(report.annotations).toHaveLength(2);
  expect(report.annotations[0]).toMatchObject({
    kind: "field",
    field: { techName: "kwota" },
    text: "Sprawdzić walutę kwoty.",
  });
  expect(report.annotations[1]).toMatchObject({
    kind: "missing",
    field: null,
    location: "Strona 1, uzasadnienie",
    text: "Brak okresu podatkowego.",
  });
  clean.title = "Inny wynik";
  await page.getByLabel("Konfiguracja JSON").setInputFiles({
    name: "inny.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(clean)),
  });
  await expect(
    page.getByRole("heading", { name: "Inny wynik", exact: true }),
  ).toBeVisible();
  const next = await downloadJson(page, "Pobierz raport uwag");
  expect(next.annotations).toEqual([]);
  expect(next.configurationSha256).not.toBe(report.configurationSha256);
});

test("real API reports authorization errors, processing, heuristic fallback and technical validation without claiming completeness", async ({
  page,
}) => {
  await loadReference(page);
  await page.getByLabel("PDF źródłowy").setInputFiles(pdf);
  await expect(
    page.getByRole("button", { name: "Prześlij PDF do API" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Prześlij PDF do API" }).click();
  await expect(page.locator("#status")).toContainText("401");
  await expect(page.locator("#status")).toContainText("UNAUTHORIZED");
  await expect(page.locator("#provenance")).toContainText("Plik lokalny");
  const { createHmac } = require("node:crypto");
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: "ui-test",
      exp: Math.floor(Date.now() / 1000) + 600,
    }),
  ).toString("base64url");
  const signature = createHmac(
    "sha256",
    "ui-test-secret-with-at-least-32-characters",
  )
    .update(`${header}.${payload}`)
    .digest("base64url");
  await page.getByText("Uwierzytelnianie API", { exact: true }).click();
  await page
    .getByLabel("Token Bearer")
    .fill(`${header}.${payload}.${signature}`);
  await page.getByRole("button", { name: "Prześlij PDF do API" }).click();
  await expect(page.locator("#status")).toContainText("Przetwarzanie");
  await expect(page.locator("#provenance")).toContainText("Tryb zastępczy", {
    timeout: 20000,
  });
  await expect(page.locator("#provenance")).toContainText("HeuristicExtractor");
  await page
    .getByRole("button", { name: "Waliduj strukturę przez API" })
    .click();
  await expect(page.locator("#validation")).toContainText("Struktura poprawna");
  await expect(page.locator("#validation")).toContainText(
    "nie potwierdza kompletności",
  );
  const clean = await downloadJson(page, "Pobierz czysty JSON");
  expect(clean.tabs.length).toBeGreaterThan(1);
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual({});
});

test("cross-page SHOW and READ_ONLY follow true, false and a repeated earlier change", async ({
  page,
}) => {
  await openReview(page);
  await page
    .getByLabel("Konfiguracja JSON")
    .setInputFiles("tests/ui/fixtures/cross-page.json");
  await page.getByRole("button", { name: "Symulacja", exact: true }).click();
  for (const value of ["Tak", "Nie", "Tak"]) {
    await page.getByRole("link", { name: "Pierwsza", exact: true }).click();
    await page.getByRole("radio", { name: value, exact: true }).check();
    await page.getByRole("link", { name: "Druga", exact: true }).click();
    const target = page.getByRole("textbox", {
      name: "Pole na drugiej stronie",
    });
    const locked = page.getByRole("textbox", { name: "Pole blokowane" });
    if (value === "Tak") {
      await expect(target).toBeVisible();
      await expect(locked).toBeDisabled();
    } else {
      await expect(target).toBeHidden();
      await expect(locked).toBeEnabled();
    }
  }
});

test("invalid expressions, unresolved references and unsupported elements stay visible as problems; source HTML stays inert", async ({
  page,
}) => {
  await openReview(page);
  const controlled = JSON.parse(
    await fs.readFile("tests/ui/fixtures/cross-page.json", "utf8"),
  );
  controlled.tabs[1].questions[0].field.states[0].query = "broken(";
  const unresolved = structuredClone(controlled.tabs[1].questions[1]);
  unresolved.field.techName = "missing-reference";
  unresolved.field.states[0].query =
    '"Tak" in tabs[title="Brak"].questions.field.__userAnswer';
  controlled.tabs[1].questions.push(unresolved);
  controlled.tabs[1].questions[1].field.type = "UNKNOWN";
  controlled.tabs[1].questions[1].field.description =
    '<script>window.injected=true</script><img src=x onerror="window.injected=true"><p>Bezpieczna treść</p>';
  await page.getByLabel("Konfiguracja JSON").setInputFiles({
    name: "errors.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(controlled)),
  });
  await page.getByRole("button", { name: "Symulacja", exact: true }).click();
  await expect(page.locator("#condition-status")).toContainText(
    "Błędy warunków (2)",
  );
  await expect(page.locator('[data-tech="zalezne"]')).toBeVisible();
  await expect(page.locator('[data-tech="missing-reference"]')).toContainText(
    "Brakujące lub niejednoznaczne odwołanie",
  );
  await expect(
    page.getByText("Nieobsługiwany typ: UNKNOWN.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Bezpieczna treść", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  await expect(page.locator("#form img, #form script")).toHaveCount(0);
});

test("keyboard can report a missing item and malformed JSON leaves the current review intact", async ({
  page,
}) => {
  await loadReference(page);
  const missing = page.getByRole("button", {
    name: "Zgłoś brakującą informację",
  });
  await missing.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByLabel("Miejsce w PDF lub opis informacji"),
  ).toBeFocused();
  await page.keyboard.type("Strona 1");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Kontrolny brak");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(missing).toBeFocused();
  await page.getByLabel("Konfiguracja JSON").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"title": "Invalid"}'),
  });
  await expect(page.locator("#status")).toContainText("Błąd JSON");
  const report = await downloadJson(page, "Pobierz raport uwag");
  expect(report.annotations[0].text).toBe("Kontrolny brak");
  expect(report.configurationTitle).toBe(
    "Wniosek o stwierdzenie nadpłaty podatku",
  );
});

test("expensive JSONata is stopped with a visible diagnostic while the UI stays responsive", async ({
  page,
}) => {
  await openReview(page);
  const controlled = JSON.parse(
    await fs.readFile("tests/ui/fixtures/cross-page.json", "utf8"),
  );
  controlled.tabs[1].questions[0].field.states[0].query =
    "($f := function(){ $f() }; $f())";
  await page.getByLabel("Konfiguracja JSON").setInputFiles({
    name: "timeout.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(controlled)),
  });
  await expect(page.locator("#condition-status")).toContainText(
    "Przekroczono limit czasu",
    { timeout: 5000 },
  );
  await page
    .getByRole("button", { name: "Zgłoś brakującą informację" })
    .click();
  await expect(page.getByLabel("Treść uwagi", { exact: true })).toBeVisible();
});

// These HTTP fixtures cover boundary labels/errors; they are NOT evidence of AI generation.
for (const [extractor, label] of [
  ["LlmExtractor", "Wynik AI"],
  ["StubExtractor", "Tryb testowy"],
  ["", "Nieznane pochodzenie"],
]) {
  test(`API contract labels ${extractor || "missing header"} without confusing it with heuristic fallback`, async ({
    page,
  }) => {
    await openReview(page);
    await page.route("**/api/v1/forms/analyze", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "X-Extractor": extractor },
        body: require("node:fs").readFileSync(reference, "utf8"),
      }),
    );
    await page.getByLabel("PDF źródłowy").setInputFiles(pdf);
    await page.getByRole("button", { name: "Prześlij PDF do API" }).click();
    await expect(page.locator("#provenance")).toContainText(label);
  });
}

test("technical validation errors are shown rather than presented as completeness", async ({
  page,
}) => {
  await loadReference(page);
  await page.route("**/api/v1/forms/validate", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        valid: false,
        errors: [{ code: "BAD_FIELD", message: "Niepoprawne pole" }],
        warnings: [],
      }),
    }),
  );
  await page
    .getByRole("button", { name: "Waliduj strukturę przez API" })
    .click();
  await expect(page.locator("#validation")).toContainText("Błędy techniczne");
  await expect(page.locator("#validation")).toContainText(
    "BAD_FIELD: Niepoprawne pole",
  );
});

test("malformed nested content cannot erase an existing review or leave a partial new result", async ({
  page,
}) => {
  await loadReference(page);
  await page
    .getByRole("button", { name: "Zgłoś brakującą informację" })
    .click();
  await page
    .getByLabel("Treść uwagi", { exact: true })
    .fill("Zachowaj tę uwagę.");
  await page.getByRole("button", { name: "Zapisz uwagę", exact: true }).click();
  const broken = {
    title: "Uszkodzona zgoda",
    tabs: [
      {
        title: "Strona",
        questions: [
          {
            field: {
              type: "CONSENT_SECTION",
              techName: "zgoda",
              consentSectionConfig: { consents: [null] },
            },
          },
        ],
      },
    ],
  };
  await page.getByLabel("Konfiguracja JSON").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(broken)),
  });
  await expect(page.locator("#status")).toContainText("Błąd JSON");
  const report = await downloadJson(page, "Pobierz raport uwag");
  expect(report.configurationTitle).toBe(
    "Wniosek o stwierdzenie nadpłaty podatku",
  );
  expect(report.annotations[0].text).toBe("Zachowaj tę uwagę.");
});
