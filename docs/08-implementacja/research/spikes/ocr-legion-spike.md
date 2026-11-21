---
wersja: 0.4.0
aktualizacja: 2026-11-21
status: implementacja
---

# Spike: Unlimited-OCR na Legionie (GTX 1660 Ti, llama.cpp CUDA i CPU) – 2026-11-21

Sprzęt: Legion, WSL2 Ubuntu 24.04 (kernel 6.6.87), 12 wątków, 11 GB RAM, GTX 1660 Ti 6 GB (Turing, sm_75),
sterownik Windows 566.36 (obsługuje CUDA <= 12.7), Docker 29.1.3. Brak sudo, brak nvcc, brak nvidia-container-toolkit.
Wejścia: te same PNG co w [ocr-m4-spike.md](ocr-m4-spike.md) (`ocr-m4-outputs/f05_p1.png` md5 231c0b18…, `f08_p1.png` md5 e6800806…).
Wyniki surowe: `ocr-legion-outputs/` (surowe wyjścia poza repo) (`*.out` tekst modelu, `*.err` log, `*.time` wall, `*.vram` próbki
nvidia-smi co 1 s, `srv_*.timings` timings z llama-server, skrypty `run.sh`, `build.sh`, `server_bench.sh`).
Model: DevQuasar/baidu.Unlimited-OCR-GGUF — `baidu.Unlimited-OCR.Q8_0.gguf` 3 126 134 912 B (sha256 4954488b…),
`mmproj-baidu.Unlimited-OCR.f16.gguf` 825 245 792 B (sha256 810660e6…), `baidu.Unlimited-OCR.Q4_K_M.gguf` 1 950 321 792 B (sha256 ccf23c8a…). Pliki leżą na Legionie w `~/ocr-bench/`, build w `~/llama.cpp/build/bin` (303 MB).
llama.cpp b12602 (commit 418fe97b5), prompt `document parsing.`, `--chat-template deepseek-ocr --temp 0 --flash-attn off -n 4096`.

## 1. Ścieżka, która zadziałała (measured)

1. **GPU w Dockerze bez nvidia-container-toolkit** (nie da się go zainstalować bez sudo). W WSL2 wystarczy przekazać urządzenie
   i biblioteki sterownika: `--device /dev/dxg -v /usr/lib/wsl:/usr/lib/wsl:ro -e LD_LIBRARY_PATH=/usr/lib/wsl/lib`.
   Montowanie samego `/usr/lib/wsl/lib` nie działa („couldn't communicate with the NVIDIA driver”) — potrzebny też
   `/usr/lib/wsl/drivers` (sterownik D3D12). `--gpus all` daje `could not select device driver "" with capabilities: [[gpu]]`.
2. **Prebuilt `ghcr.io/ggml-org/llama.cpp:full-cuda-b12602` = ślepa uliczka** (tag `full-cuda12-b12602` to ten sam digest
   sha256:8b8c6f5e…). Obraz widzi GPU (`CUDA0: NVIDIA GeForce GTX 1660 Ti (6143 MiB, 5130 MiB free)`), ale przy pierwszym
   kernelu: `CUDA error: the provided PTX was compiled with an unsupported toolchain` (ggml-cuda.cu:972). Powód: obraz zbudowany
   na CUDA 12.8.1 (`NVIDIA_REQUIRE_CUDA=cuda>=12.8`), SASS tylko dla sm_120, reszta jako PTX; sterownik 566.36 (CUDA 12.7)
   nie potrafi JIT-ować PTX z 12.8. To samo dotyczy `-ngl 0`, bo mtmd i tak offloaduje mmproj na GPU (patrz blokery).
   Naprawa wymaga aktualizacji sterownika Windows (poza zasięgiem z WSL bez admina).
3. **Build ze źródeł w kontenerze `nvidia/cuda:12.6.3-devel-ubuntu24.04`, prawdziwe SASS sm_75** — zadziałało:

```bash
git clone --depth 1 --branch b12602 https://github.com/ggml-org/llama.cpp ~/llama.cpp
docker pull nvidia/cuda:12.6.3-devel-ubuntu24.04
docker run --rm -v $HOME/llama.cpp:/src -w /src nvidia/cuda:12.6.3-devel-ubuntu24.04 bash -c "
  apt-get update -qq && apt-get install -y -qq cmake git libcurl4-openssl-dev &&
  ln -sf /usr/local/cuda/lib64/stubs/libcuda.so /usr/local/cuda/lib64/stubs/libcuda.so.1 &&
  export LD_LIBRARY_PATH=/usr/local/cuda/lib64/stubs &&
  cmake -B build -DGGML_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES=75 -DLLAMA_CURL=OFF -DGGML_NATIVE=ON &&
  cmake --build build -j12 --target llama-mtmd-cli llama-server llama-bench llama-cli"
# kompilacja: 1394 s (23 min) na 12 wątkach; bez symlinku stuba link llama-mtmd-cli pada
# („libcuda.so.1 … not found”, undefined reference to cuMemCreate…).

# uruchomienie (ten sam obraz devel jako runtime; binarki w ~/llama.cpp/build/bin):
docker run --rm --device /dev/dxg -v /usr/lib/wsl:/usr/lib/wsl:ro \
  -e LD_LIBRARY_PATH=/usr/lib/wsl/lib:/usr/local/cuda/lib64 \
  -v $HOME/ocr-bench:/work -v $HOME/llama.cpp:/src --entrypoint /src/build/bin/llama-mtmd-cli \
  nvidia/cuda:12.6.3-devel-ubuntu24.04 \
  -m /work/baidu.Unlimited-OCR.Q8_0.gguf --mmproj /work/mmproj-baidu.Unlimited-OCR.f16.gguf \
  --image /work/f05_p1.png -p "document parsing." --chat-template deepseek-ocr --temp 0 --flash-attn off -ngl 99 -t 12 -n 4096
```

4. **CPU-only**: prebuilt obraz `full-cuda-b12602` bez `--device /dev/dxg` i z `--no-mmproj-offload` (backend CPU z tego
   obrazu działa; nasz build z CUDA nie wstanie bez `libcuda.so.1`, więc do CPU użyty prebuilt). `-ngl 0 -t 12`.
5. **pp/tg tok/s**: `llama-mtmd-cli` nie wypisuje `llama_perf_context_print` przy domyślnym poziomie logów (tylko
   `mtmd batch encoding done in N ms`), więc tok/s zmierzone przez `llama-server` (`/completion` z
   `{"prompt":{"prompt_string":"<__media__>document parsing.","multimodal_data":["<base64>"]}}`; wymaga
   `-e LLAMA_MEDIA_MARKER="<__media__>"`, bo serwer losuje marker per proces). Skrypt: `ocr-legion-outputs/server_bench.sh`.
6. Pobieranie: `-hf` nieużyte (build bez libcurl); pliki ściągnięte `curl -L` z HF. Łącze Legiona: 70–85 KB/s na starcie
   (równolegle z `docker pull`), potem 2,4–11,8 MB/s; `docker pull` raz zawisł na 0 KB/s i wymagał restartu.
   Ścieżka Mac -> Legion przez Tailscale (relay/WAN, 600 ms) < 170 KB/s — nieprzydatna.

## 2. Pomiary (measured)

Wall = cały `docker run` (start kontenera + load modelu + encode + decode). VRAM = szczyt `memory.used` z nvidia-smi dla
całej karty; przed startem karta ma 0,4–0,5 GB zajęte przez Windows, więc proces zajmuje ~5,4 GB (Q8) / ~5,0 GB (Q4 server).
Prompt = 908 tokenów (obraz w trybie gundam: 6 chunków + tekst) dla obu stron.

| Strona | Urządzenie | Quant | Narzędzie | Wall | pp tok/s | tg tok/s | VRAM (used total / 6144 MiB) | Jakość |
|---|---|---|---|---|---|---|---|---|
| f05 p1 | GPU | Q8_0 | mtmd-cli, zimny | 25,0 s (encode 7,5 s + 4,4 s) | – | – | 5950 | 26 bloków, tekst = M4, 0 błędów PL |
| f05 p1 | GPU | Q8_0 | mtmd-cli, ciepły | 20,3 s (encode 7,2 + 4,2 s) | – | – | 5950 | bajt w bajt = run 1 (deterministyczne) |
| f05 p1 | GPU | Q8_0 | llama-server | 13,3 s request | 908 tok / **105,7** (8,6 s) | 722 tok / **173,7** (4,1 s) | 5948 | eos, ten sam tekst |
| f08 p1 | GPU | Q8_0 | mtmd-cli | 24,4 s (encode 7,2 + 4,4 s) | – | – | 5926 | **3 bloki** – cała strona jako jedna tabela, ☐ x6, 8 błędnych słów |
| f08 p1 | GPU | Q8_0 | llama-server | 17,2 s request | 908 / **110,6** (8,2 s) | 1493 / **169,5** (8,8 s) | 5948 | eos, ten sam tekst co mtmd-cli |
| f05 p1 | GPU | Q4_K_M | mtmd-cli | 20,0 s | – | – | 5932 | 26 bloków, ale „nadpłaty” -> „nadłąty” x3 |
| f08 p1 | GPU | Q4_K_M | mtmd-cli | 39,3 s | – | – | 5930 | **degeneracja**: limit 4096 tok., 62 puste wiersze `<tr>`, 2 bloki |
| f08 p1 | GPU | Q4_K_M | llama-server | 29,7 s request | 908 / 126,1 (7,2 s) | 4096 / 184,1 (22,2 s), stop=limit | 5460 | j.w. |
| f05 p1 | CPU 12 wątków | Q8_0 | mtmd-cli | **126,1 s** (encode 30,1 + 17,8 s; decode ~66 s = ~11 tok/s szac.) | – | – | 0 | tekst identyczny z GPU Q8 (1 bbox ±1) |
| f05 p1 | CPU 12 wątków | Q4_K_M | mtmd-cli | **99,3 s** (encode 38,1 + 18,0 s; decode ~30 s = ~24 tok/s szac.) | – | – | 0 | tekst identyczny z GPU Q4 (bbox ±1), z „nadłąty” |

Dla porównania M4 (MLX 4-bit, model w cache): f05 34 s, f08 29 s. Legion GPU Q8: 20–25 s przez CLI, 13–17 s jako request do
serwera (bez startu kontenera i loadu). CPU Q8: 126 s/strona, z czego 48 s to sam enkoder obrazu (mmproj f16 na CPU).

## 3. Jakość vs M4 (`ocr-m4-outputs/f05_p1_run2.out`, `f08_p1_run2.out`)

**f05 p1** – Legion GPU Q8 vs M4 4-bit: 26 vs 26 bloków, tekst wszystkich bloków identyczny, **0 błędów polskich znaków**
po obu stronach. Różnice tylko w etykietach i kropkach: M4 daje `text` dla „PESEL *”, „NIP *”, „Uzasadnienie:”,
„w załączeniu:” i `page_footnote` dla przypisu; Legion daje `title`/`text`. M4 zachowuje kropki („PESEL *......”,
„...... w kwocie ......”), Legion je gubi („PESEL *”, „w kwocie”). Bboxy różnią się o 1–3/1000. Q4_K_M psuje słowo
„nadpłaty” (3x „nadłąty”) na GPU i CPU — **Q4_K_M w llama.cpp nie jest odpowiednikiem MLX 4-bit**, który na M4 był bezbłędny.

**f08 p1** – Legion GPU Q8: 3 bloki (`title`, `table` z całą stroną, `page_number`) — ta sama zapaść w jedną tabelę,
którą M4 dał dla 6-bit; M4 4-bit dał 28 bloków. Q4_K_M na Legionie jeszcze gorzej (degeneracja do pustych wierszy do limitu
tokenów). Zliczenie błędów polskich w zakresie pierwszych 20 bloków M4 (do „5. Nazwisko, imię”):
- Legion Q8: **6 błędnych słów** — WYOSKOŚCI, MIESIĘCZNĘJ, właśnieciel (x2), najmęca, petna. Na całej stronie 8 (+ dziełek, wpętnąć).
- M4 4-bit: **10** — WYOSKOŃCI, MIESIĘCZNJE, OPLATY, skladający, współtwąściciel (x2), najmca, współnota, petna, wypetnić.
- Tytuł: Legion „DEKLARACJA O WYOSKOŚCI MIESIĘCZNĘJ OPŁATY” (2 błędy) vs M4 „WYOSKOŃCI MIESIĘCZNJE OPLATY” (3). Błędy w tych
  samych miejscach (drobny druk, tytuł rozstrzelony) -> to problem modelu, nie kwantyzacji ani backendu.
- Kratki: Legion `☐` (U+2610) x6 z etykietami 1–6; M4 `□` (U+25A1) x6. Są w obu, tylko inny glif.
- Puste pola: M4 = osobne bloki `image` z bboxem (PESEL, NIP, nazwisko…); Legion = wiersze 20 pustych `<td>` wewnątrz tabeli
  (kratki na znaki), bez bboxów per pole. Legion zgubił wiersz „4. NIP/REGON (dot. tylko osób prawnych)” i komórki
  „10. Gmina”, „15. Kod pocztowy”; oba skleiły „Prezydent Miasta Gdyni / Al. Marszałka… / 81-382 Gdynia” w jedną komórkę.
- Tabela B.3 jako HTML w obu.

Gotcha llama-server: `<|det|>`, `<|/det|>`, `<tr>`, `<td>`, `</td>`, `</tr>` to tokeny specjalne i serwer usuwa je z
`content` (zostaje „title [266, 125, 732, 158]DEKLARACJA…”). Do produkcji przez serwer trzeba oddać surowe tokeny lub
użyć `llama-mtmd-cli`/libmtmd bezpośrednio; `srv_*.out` nadają się tylko do porównania tekstu.

## 4. Blokery

- Brak sudo na Legionie: nie da się zainstalować nvidia-container-toolkit ani `nvidia-cuda-toolkit`; obejście = `/dev/dxg`
  + `/usr/lib/wsl` do kontenera, kompilacja w obrazie `nvidia/cuda:*-devel`.
- Sterownik 566.36 = CUDA 12.7: prebuilt obrazy llama.cpp (CUDA 12.8) padają na PTX JIT; każdy nowszy prebuilt będzie padać,
  dopóki sterownik Windows nie zostanie zaktualizowany. Build własny z `CMAKE_CUDA_ARCHITECTURES=75` jest konieczny.
- `-ngl 0` nie oznacza CPU: mtmd offloaduje mmproj na GPU; do CPU trzeba `--no-mmproj-offload` albo brak urządzenia.
- Link `llama-mtmd-cli` w obrazie devel wymaga `libcuda.so.1` -> symlink stuba.
- 6 GB VRAM na styk: Q8 + mmproj f16 + ctx 8192 = 5,95/6,14 GB used na karcie, `common_fit_params` ostrzega. Zero miejsca na
  drugi proces na GPU; przy dłuższym kontekście/wielu slotach trzeba Q6_K/Q5_K_M (niezmierzone) albo mmproj q8_0.
- Łącze Legiona: 4 GB plików = 30+ min; `docker pull` zawiesił się raz. Dla demo wszystko musi być prepulled.
- `llama-mtmd-cli` bez tok/s w logu; serwer losuje marker mediów (`LLAMA_MEDIA_MARKER`), serwer gubi tokeny specjalne.
- Nie zmierzone: Q5_K_M/Q6_K, `-n` > 4096 dla gęstszych stron, 16-stronicowy PDF w jednym procesie (`infer_multi`), vLLM/PyTorch.

## 5. Werdykt

**GTX 1660 Ti jako box do demo OCR: tak, warunkowo.** Po własnym buildzie llama.cpp (CUDA 12.6, sm_75) Unlimited-OCR Q8_0
robi stronę formularza w 13–17 s jako request do `llama-server` (pp ~105–110 tok/s, tg ~170 tok/s) i 20–25 s przez CLI z
loadem, czyli 1,5–2x szybciej niż M4 Metal, z tekstem polskim identycznym jak na M4 (f05 bezbłędny; f08 nawet mniej błędów
niż M4 4-bit) — ale VRAM jest na granicy (5,95/6,14 GB), więc to jeden proces, jedna strona naraz, ~5 min na 16 stron,
i tylko Q8 (Q4_K_M psuje polskie słowa i degeneruje się na f08). Niestabilność układu (f08 raz bloki, raz jedna tabela)
zostaje niezależnie od sprzętu. **CPU-only dla jury: nie do live demo.** 99–126 s na stronę przy 12 wątkach (połowa to
enkoder obrazu, który na CPU nie przyspieszy kwantyzacją) = 27–34 min na 16 stron; jakość jest ta sama co na GPU, więc CPU
nadaje się tylko na batch w tle lub na pokazanie jednej strony „na żywo” z 2-minutowym czekaniem. Dla ścieżki CPU jury
baseline zostaje Tesseract/rapidocr + docling (sekundy na stronę), a Unlimited-OCR jako opcjonalny `OCR_BACKEND=unlimited`
wskazujący na `llama-server` na Legionie (prepulled obraz + nasz build + GGUF Q8 offline).
