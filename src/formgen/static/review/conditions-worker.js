/* JSONata runs off the UI thread. The caller terminates costly expressions. */
import "./vendor/jsonata.min.js";
import { fields } from "./configuration.mjs";
const jsonata = self.jsonata;
self.onmessage = async ({ data: { config, answers } }) => {
  const entries = fields(config);
  for (const { key, field } of entries) field.__userAnswer = answers[key] ?? "";
  const results = {};
  for (const { key, field, parent } of entries) {
    const state = { show: true, readOnly: Boolean(field.readOnly), errors: [] };
    for (const rule of field.states ?? []) {
      try {
        if (!rule || !["SHOW", "READ_ONLY"].includes(rule.type))
          throw new Error(`Nieobsługiwany stan: ${rule?.type}`);
        if (typeof rule.query !== "string" || !rule.query.trim())
          throw new Error("Puste wyrażenie.");
        // Reference 05 and the composer use these COI paths. Resolve their targets
        // separately: a missing/ambiguous field must not silently become false.
        const references =
          rule.query.match(
            /tabs(?:\s*\[[^\]]*\]|\.[A-Za-z_]\w*)*?\.__userAnswer/g,
          ) ?? [];
        if (rule.query.includes("__userAnswer") && !references.length)
          throw new Error("Nieobsługiwany zapis odwołania do odpowiedzi.");
        for (const reference of references) {
          const target = await jsonata(
            reference.replace(/\.__userAnswer$/, ""),
          ).evaluate(config);
          if (!target || Array.isArray(target))
            throw new Error("Brakujące lub niejednoznaczne odwołanie do pola.");
        }
        const result = await jsonata(rule.query).evaluate(config);
        if (typeof result !== "boolean")
          throw new Error("Warunek nie zwrócił prawdy ani fałszu.");
        if (rule.type === "SHOW") state.show = state.show && result;
        if (rule.type === "READ_ONLY")
          state.readOnly = state.readOnly || result;
      } catch (error) {
        state.errors.push(`${rule?.type ?? "?"}: ${error.message}`);
      }
    }
    if (state.errors.length) {
      state.show = true;
      state.readOnly = true;
    }
    if (parent) {
      state.show = state.show && results[parent].show;
      state.readOnly = state.readOnly || results[parent].readOnly;
    }
    results[key] = state;
  }
  self.postMessage(results);
};
