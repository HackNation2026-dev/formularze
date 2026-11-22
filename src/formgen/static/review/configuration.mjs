export function fields(config) {
  const out = [];
  function walk(questions, prefix, parent = null) {
    questions.forEach((q, i) => {
      const key = `${prefix}.${i}`;
      out.push({ key, field: q.field, parent });
      walk(q.field.repeatingSectionGrid ?? [], key, key);
    });
  }
  config.tabs.forEach((tab, i) => walk(tab.questions, `${i}`));
  return out;
}
export function checkShape(config) {
  if (
    !config ||
    typeof config.title !== "string" ||
    !Array.isArray(config.tabs) ||
    !config.tabs.length
  )
    throw new Error("Konfiguracja wymaga tytułu i niepustej listy tabs.");
  function walk(questions) {
    if (!Array.isArray(questions))
      throw new Error("Strona lub sekcja wymaga listy pól.");
    for (const q of questions) {
      const f = q?.field;
      if (!f || typeof f.type !== "string" || typeof f.techName !== "string")
        throw new Error("Pole wymaga type i techName.");
      for (const key of ["options", "states", "repeatingSectionGrid"]) {
        if (f[key] !== undefined && !Array.isArray(f[key]))
          throw new Error(`${f.techName}: ${key} musi być listą.`);
      }
      if (
        f.options?.some(
          (o) => !o || typeof o.id !== "string" || typeof o.name !== "string",
        )
      )
        throw new Error(`${f.techName}: błędne opcje.`);
      if (
        f.consentSectionConfig &&
        (!Array.isArray(f.consentSectionConfig.consents) ||
          f.consentSectionConfig.consents.some(
            (consent) => !consent || typeof consent.description !== "string",
          ))
      )
        throw new Error(`${f.techName}: błędne zgody.`);
      walk(f.repeatingSectionGrid ?? []);
    }
  }
  for (const tab of config.tabs) {
    if (typeof tab.title !== "string") throw new Error("Strona wymaga tytułu.");
    walk(tab.questions);
  }
}

// Sorted object keys make the fingerprint independent of JSON whitespace/key order.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export async function digest(value) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical(value)),
  );
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// COI FieldType (src/formgen/schema/model.py). A retype keeps the kind, so
// children stay inside a container and a leaf never gains a grid.
export const CONTAINER_TYPES = ["SECTION", "REPEATING_SECTION"];
const ELEMENT_TYPES = [
  "TEXT_FIELD",
  "TEXTAREA",
  "NUMBER",
  "CHECKBOX",
  "RADIO",
  "SELECT",
  "DATEPICKER",
  "FILE_UPLOADER",
  "CONSENT_SECTION",
  "TEXT_BLOCK",
  "INFO_SECTION",
];
export function typeChoices(type) {
  const choices = CONTAINER_TYPES.includes(type)
    ? CONTAINER_TYPES
    : ELEMENT_TYPES;
  return choices.includes(type) ? choices : [type, ...choices];
}

// Applies one clerk edit in place and returns its log entries.
// change is { delete: true } or holds only the changed title and/or type.
export function editField(config, key, change) {
  const [tab, ...path] = key.split(".").map(Number);
  let list = config.tabs[tab].questions;
  for (const i of path.slice(0, -1)) list = list[i].field.repeatingSectionGrid;
  const index = path.at(-1),
    question = list[index],
    field = question.field;
  if (change.delete) {
    list.splice(index, 1);
    // Close the row gap so the remaining grid stays 0..n-1.
    for (const other of list)
      if (other.y > question.y) {
        if (other.field.questionOrder === other.y)
          other.field.questionOrder -= question.rows ?? 1;
        other.y -= question.rows ?? 1;
      }
    const removed = [];
    (function collect(q) {
      removed.push(q.field.techName);
      (q.field.repeatingSectionGrid ?? []).forEach(collect);
    })(question);
    return [{ action: "delete", techName: field.techName, removed }];
  }
  const entries = [];
  if ("title" in change) {
    entries.push({
      action: "rename",
      techName: field.techName,
      from: field.title,
      to: change.title,
    });
    field.title = change.title;
  }
  if ("type" in change) {
    entries.push({
      action: "retype",
      techName: field.techName,
      from: field.type,
      to: change.type,
    });
    field.type = change.type;
  }
  return entries;
}
