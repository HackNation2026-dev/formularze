import { fields, typeChoices, CONTAINER_TYPES } from "./configuration.mjs";
// Source/model strings become text nodes only; imported HTML never enters the live DOM.
export function text(value) {
  const doc = new DOMParser().parseFromString(String(value ?? ""), "text/html");
  doc
    .querySelectorAll("script,style,iframe,object,embed")
    .forEach((node) => node.remove());
  doc.querySelectorAll("p,br,li,div").forEach((node) => node.append("\n"));
  return doc.body.textContent.trim();
}
export function element(tag, content, className) {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  if (className) node.className = className;
  return node;
}
export function renderForm(config, answers, onAnswer, onNote, onEdit) {
  const host = document.querySelector("#form");
  const nav = document.querySelector("#pages");
  host.replaceChildren();
  nav.replaceChildren();
  host.append(element("h2", text(config.title)));
  const views = new Map();
  const fieldIndex = new Map(
    fields(config).map((entry) => [entry.field, entry]),
  );
  function walk(questions, target, inContainer = false) {
    const sorted = questions
      .map((q, i) => ({ q, i }))
      .sort(
        (a, b) =>
          (a.q.y ?? a.q.field.questionOrder ?? 0) -
            (b.q.y ?? b.q.field.questionOrder ?? 0) ||
          (a.q.x ?? 0) - (b.q.x ?? 0),
      );
    for (const { q } of sorted) {
      const f = q.field;
      const { key } = fieldIndex.get(f);
      const container = f.type === "SECTION";
      const box = element(
        "section",
        undefined,
        `field${container ? " container" : ""}`,
      );
      box.dataset.field = key;
      box.dataset.tech = f.techName;
      const title = text(f.title) || f.techName;
      box.append(element(container ? "h3" : "h4", title));
      box.append(
        element(
          "span",
          `${f.type} · ${f.techName}${Array.isArray(f.validation) && f.validation.includes("REQUIRED") ? " · wymagane" : ""}`,
          "meta",
        ),
      );
      if (text(f.description))
        box.append(element("p", text(f.description), "prose"));
      if (text(f.tooltipMessage))
        box.append(element("p", text(f.tooltipMessage), "meta"));
      if (f.defaultValueType === "EXTERNAL_SYSTEM")
        box.append(
          element(
            "p",
            `Rejestr niepodłączony: ${f.defaultValue}. Wpisz własne dane przykładowe w symulacji.`,
            "warning",
          ),
        );
      const stateInfo = element("p", "", "condition-info");
      const error = element("p", "", "condition-error");
      error.hidden = true;
      box.append(stateInfo, error);
      const controls = [];
      function control(input, label = title) {
        input.setAttribute("aria-label", label);
        input.dataset.answer = key;
        controls.push(input);
        return input;
      }
      function update(value) {
        answers.set(key, value);
        onAnswer();
      }
      const value = answers.get(key);
      if (["TEXT_FIELD", "NUMBER", "TEXTAREA", "DATEPICKER"].includes(f.type)) {
        const input = control(
          element(f.type === "TEXTAREA" ? "textarea" : "input"),
        );
        if (f.type !== "TEXTAREA")
          input.type =
            { NUMBER: "number", DATEPICKER: "date" }[f.type] ?? "text";
        if (f.type === "NUMBER") input.step = "any";
        input.value = value ?? "";
        input.addEventListener("input", () =>
          update(
            f.type === "NUMBER" && input.value !== ""
              ? Number(input.value)
              : input.value,
          ),
        );
        box.append(input);
      } else if (["RADIO", "CHECKBOX"].includes(f.type)) {
        const group = element("fieldset");
        group.append(element("legend", title));
        for (const option of f.options ?? []) {
          const label = element("label", undefined, "choice"),
            input = control(element("input"), text(option.name));
          input.type = f.type.toLowerCase();
          input.name = key;
          input.value = option.id;
          input.checked = Array.isArray(value) && value.includes(option.id);
          input.addEventListener("change", () =>
            update(controls.filter((c) => c.checked).map((c) => c.value)),
          );
          label.append(input, document.createTextNode(text(option.name)));
          group.append(label);
        }
        box.append(group);
      } else if (f.type === "SELECT") {
        if (f.dictionaryName && !f.options?.length) {
          box.append(
            element(
              "p",
              `Słownik ${f.dictionaryName} niepodłączony. Wpisz wartość przykładową (np. Polska lub Niemcy).`,
              "warning",
            ),
          );
          const input = control(element("input"));
          input.value = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
          input.addEventListener("input", () =>
            update(input.value ? [input.value] : []),
          );
          box.append(input);
        } else {
          const select = control(element("select"));
          const empty = element("option", "— wybierz —");
          empty.value = "";
          select.append(empty);
          for (const o of f.options ?? []) {
            const option = element("option", text(o.name));
            option.value = o.id;
            select.append(option);
          }
          select.value = Array.isArray(value)
            ? (value[0] ?? "")
            : (value ?? "");
          select.addEventListener("change", () =>
            update(select.value ? [select.value] : []),
          );
          box.append(select);
        }
      } else if (f.type === "FILE_UPLOADER") {
        const input = control(element("input"));
        input.type = "file";
        input.multiple = true;
        input.addEventListener("change", () =>
          update([...input.files].map((file) => file.name)),
        );
        box.append(
          input,
          element(
            "small",
            "Załącznik przykładowy: nie jest przesyłany do API.",
          ),
        );
      } else if (f.type === "CONSENT_SECTION") {
        (f.consentSectionConfig?.consents ?? []).forEach((consent, index) => {
          const label = element("label", undefined, "choice"),
            input = control(element("input"), text(consent.description));
          input.type = "checkbox";
          input.checked = Boolean(value?.[index]);
          input.addEventListener("change", () =>
            update(controls.map((c) => c.checked)),
          );
          label.append(
            input,
            document.createTextNode(
              `${text(consent.description)}${consent.required ? " (wymagana)" : ""}`,
            ),
          );
          box.append(label);
        });
      } else if (!["SECTION", "TEXT_BLOCK", "INFO_SECTION"].includes(f.type)) {
        box.append(
          element(
            "p",
            `Nieobsługiwany typ: ${f.type}. Element wymaga ręcznego sprawdzenia.`,
            "warning",
          ),
        );
      }
      if (f.states?.length) {
        const details = element("details");
        details.append(element("summary", "Warunki konfiguracji"));
        for (const state of f.states)
          details.append(
            element(
              "pre",
              `${state?.type ?? "?"}: ${state?.query ?? "Brak wyrażenia"}`,
              "prose",
            ),
          );
        box.append(details);
      }
      const note = element("button", "Dodaj uwagę", "annotation-button");
      note.setAttribute("aria-label", `Dodaj uwagę: ${title}`);
      note.addEventListener("click", () =>
        onNote({ id: f.id, techName: f.techName, title }, f),
      );
      const edit = element("button", "Edytuj pole", "annotation-button");
      edit.setAttribute("aria-label", `Edytuj pole: ${title}`);
      edit.addEventListener("click", () => {
        edit.hidden = true;
        const form = editor(
          f,
          inContainer && questions.length === 1,
          (change) => onEdit(key, change),
          () => {
            form.remove();
            edit.hidden = false;
            edit.focus();
          },
        );
        edit.after(form);
        form.querySelector("input").focus();
      });
      box.append(note, edit);
      views.set(key, { box, controls, stateInfo, error, edit });
      target.append(box);
      walk(f.repeatingSectionGrid ?? [], box, CONTAINER_TYPES.includes(f.type));
    }
  }
  config.tabs.forEach((tab, i) => {
    const section = element("section", undefined, "form-page");
    section.id = `page-${i}`;
    section.append(element("h2", `${i + 1}. ${text(tab.title)}`));
    const link = element("a", text(tab.title));
    link.href = `#page-${i}`;
    nav.append(link);
    walk(tab.questions, section);
    host.append(section);
  });
  return views;
}
// A section keeps at least one field: its last field is removed with the section.
function editor(f, lastInSection, onEdit, onCancel) {
  const form = element("form", undefined, "field-editor");
  const label = element("label", "Etykieta pola"),
    name = element("input");
  name.value = text(f.title);
  label.append(name);
  const typeLabel = element("label", "Typ pola"),
    type = element("select");
  for (const choice of typeChoices(f.type))
    type.append(element("option", choice));
  type.value = f.type;
  typeLabel.append(type);
  const save = element("button", "Zapisz zmiany"),
    remove = element("button", "Usuń pole"),
    cancel = element("button", "Anuluj");
  remove.type = cancel.type = "button";
  remove.disabled = lastInSection;
  form.append(label, typeLabel, save, remove, cancel);
  if (lastInSection)
    form.append(
      element("small", "Ostatnie pole sekcji: usuń całą sekcję.", "meta"),
    );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const change = {};
    if (name.value.trim() !== text(f.title)) change.title = name.value.trim();
    if (type.value !== f.type) change.type = type.value;
    if (Object.keys(change).length) onEdit(change);
    else onCancel();
  });
  remove.addEventListener("click", () => onEdit({ delete: true }));
  cancel.addEventListener("click", onCancel);
  return form;
}
