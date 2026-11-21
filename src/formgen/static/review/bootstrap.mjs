try {
  await import("./app.mjs");
  document.getElementById("pdf-file").disabled = false;
  document.getElementById("json-file").disabled = false;
} catch {
  document.getElementById("status").textContent =
    "Nie udało się uruchomić interfejsu. Przygotuj zasoby lokalne w katalogu projektu: npm ci && npm run ui:assets. Następnie odśwież stronę. API pozostaje niezależne od przygotowania UI.";
}
