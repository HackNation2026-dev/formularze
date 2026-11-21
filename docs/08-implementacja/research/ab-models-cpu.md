---
wersja: 0.4.0
aktualizacja: 2026-11-21
status: pomiar
---

# A/B rozmiaru modelu na samym CPU (x86, i7-9750H, 6 rdzeni, llama.cpp server-b12602, nic innego na maszynie)

Pytanie: czy mniejszy model wystarcza, skoro kompilator i walidator robią większość pracy. Jury może nie mieć GPU.

| Model | Plik | Golden 05 composite / recall / czas | Golden 01 composite / recall / czas | Formularz 08 (6 str.) czas | Błędy reguł |
|---|---|---|---|---|---|
| Qwen3.5-0.8B | Qwen3.5-0.8B-Q8_0.gguf | 0.89 / 0.87 / 302s | 0.90 / 0.92 / 301s | 2134s | none | warnings: 0 |
| Qwen3.5-2B | Qwen3.5-2B-Q4_K_M.gguf | 0.92 / 0.93 / 74s | 0.91 / 0.91 / 215s | 1189s | none | warnings: 0 |
| Qwen3.5-4B | Qwen3.5-4B-Q4_K_M.gguf | 0.93 / 0.93 / 242s | 0.91 / 0.96 / 250s | 708s | none | warnings: 0 |

Czas = cały pipeline łącznie z parsowaniem, mierzony z MacBooka przez Tailscale (narzut sieci pomijalny). Golden = plik referencyjny organizatora; composite i recall z src/formgen/eval/metric.py.

Uwaga do wiersza 0.8B: zmierzony w pierwszym przebiegu przy 12 wątkach i prawie pełnej pamięci RAM (obok stał serwer GPU z modelem 4B), więc jest zawyżony. Wiersze 2B i 4B: 6 wątków, nic innego na maszynie.

## Wnioski (zmierzone)
- Jakość prawie nie zależy od rozmiaru modelu: composite 0.89–0.93 dla wszystkich trzech. Kompilator i walidator robią większość pracy.
- Czas na CPU zależy od liczby wygenerowanych tokenów, nie od rozmiaru modelu: 2B wygrywa na prostym formularzu (74 s vs 242 s), ale przegrywa na 6-stronicowym (1189 s vs 708 s), bo pisze dłuższe odpowiedzi i częściej trafia w limit tokenów.
- 0.8B odpada: najwolniejszy i najsłabszy.
- Decyzja: domyślnie zostaje 4B (najlepsza jakość, przewidywalny czas na długich formularzach). 2B to opcja `LLM_GGUF=Qwen3.5-2B-Q4_K_M.gguf` dla maszyn z małą pamięcią.
- Obrona: na samym CPU prosty formularz to 1–4 min, 6 stron to 12–20 min. Dlatego demo idzie przez otwarty model w chmurze (zgoda mentora), a tryb lokalny jest zapasem i dowodem działania offline.
- Tania dźwignia na CPU: wspólny prefiks promptu musi być identyczny między wywołaniami, żeby llama.cpp użył cache (`cache_prompt`). Dotąd numer stron stał na początku promptu i psuł cache: ~1500 tokenów instrukcji liczone od nowa przy każdym wywołaniu (~25 s na CPU). Poprawione w tym samym PR.
