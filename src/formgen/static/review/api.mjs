export async function api(path, body, token, json = false) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (json) headers["Content-Type"] = "application/json";
  const response = await fetch(`/api/v1/forms/${path}`, {
    method: "POST",
    headers,
    body: json ? JSON.stringify(body) : body,
    signal: AbortSignal.timeout(600000),
  });
  let value;
  try {
    value = await response.json();
  } catch {
    throw new Error(`HTTP ${response.status}: odpowiedź API nie jest JSON.`);
  }
  if (!response.ok)
    throw new Error(
      `HTTP ${response.status}: ${value.error?.code ?? "API_ERROR"} — ${value.error?.message ?? JSON.stringify(value)}${value.error?.details ? " " + JSON.stringify(value.error.details) : ""}`,
    );
  return { value, headers: response.headers };
}
