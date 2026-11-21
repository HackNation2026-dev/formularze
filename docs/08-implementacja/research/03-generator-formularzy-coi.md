---
wersja: 0.4.0
aktualizacja: 2026-11-21
status: implementacja
---

# 03 – Target system: COI "Generator Formularzy" and its conventions

Date: 2026-11-21. Scope: what is publicly known about the target system, JSONata semantics for `states[].query`,
initial-data sources, Polish validators, e-form standards, reusable field vocabularies.
Claim tags: **[measured]** = we ran it, **[reported]** = primary source says so, **[guess]** = our inference.

## 1. TL;DR

- **There is no public documentation of COI's "Generator Formularzy"** (no docs, tenders, talks, GitHub). The only
  spec is the Discord material; the two golden JSONs are the de-facto standard. Treat
  `docs/materialy/referencyjne_json_outline.md` as the schema of record, the JSON Schema file as secondary.
- Public architecture context exists: gov.pl "Architektura Informacyjna Państwa" (AIP) describes the central
  "Generowanie interaktywnych formularzy internetowych" mechanism, with a reusable **address widget bound to TERYT**
  and templates from the Katalog Wzorów Dokumentów (KWD). It confirms the pattern (prefill from registers, step
  gating, validation) but adds no field-level vocabulary.
- **JSONata lint: use `jsonata-python` 0.7.2 (Apache-2.0, pure Python)** [measured]. All 60 golden queries
  (14 unique) parse; syntax errors raise `jsonata.jexception.JException`. Semantics measured: `"X" in __userAnswer`
  works for string or array answers; `'Dane' in title` is an **exact** match, not substring; `$not(...)` of a
  missing/unanswered field evaluates **true** (the dependent field shows); unbound `$repeatingSectionIndex` returns
  `None` without error.
- `TERYT_DOWODOWY` / `TERYT_4G_DOWODOWY` / `MLPZ` are **not public names**; nothing found on gov.pl, GUS, BIP.
  Use them exactly as the golden files do (dictionary name == field `title`, `multiLevelTree: true`,
  `searchEnabled: true`, techName `wojewodztwo*`). Default to `TERYT_4G_DOWODOWY` (4 of 6 uses, the newer example).
- Validators: implement PESEL, NIP, REGON 9/14, ID-card (3 letters + 6 digits, weights 7,3,1,9,7,3,1,7,3 mod 10),
  ZIP `^\d{2}-\d{3}$`, ADE `^AE:PL-\d{5}-\d{5}-[A-Z]{5}-\d{2}$`, ePUAP `^/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+$` [guess].
  All checksums verified numerically against published examples [measured]. No PyPI package covers all of them
  with a clean licence; write ~60 lines ourselves.
- "Strony alternatywne" (alternative pages) have **no representation in the JSON schema** (`flow.links` has only
  `source/target`, tabs have no `states`). Model branching as whole-`SECTION` `SHOW` states on one MAIN tab
  (what both golden files do). Ask the mentor whether multiple links from one tab are allowed.

## 2. Options compared (tooling decisions this research feeds)

| Need | Option | Licence | Verdict |
|---|---|---|---|
| JSONata parse/eval in Python | `jsonata-python` 0.7.2 (rayokota) | Apache-2.0 | **Use.** Pure Python, 100% language coverage, `JException` on syntax error [measured] |
| | `jsonatapy` (Rust bindings) | MIT | Fine too, but adds a native wheel to the Docker image; no need |
| Polish ID validators | `poland-py` (PyPI) | unclear, alpha, PESEL only | Skip |
| | `validate-polish` (npm) | MIT/GPL mixed by version | Not Python; skip |
| | own `validators.py` | – | **Write it** (algorithms below, all verified) |
| Field vocabulary source | CRD common XSDs (`osoba.xsd`, `adres.xsd`) | public gov schemas | Use offline as a label->techName synonym list, not a runtime dep |

## 3. Findings per topic

### 3.1 Generator Formularzy (COI) – public footprint

- Searches for "Generator Formularzy" + COI/jsonata/TERYT_DOWODOWY/MLPZ/"AI HUB"/Multiportal returned **nothing
  technical** [reported: WebSearch, gov.pl, BIP, GitHub]. The product is internal to COI's e-usługi platform.
- AIP "Model realizacji e-usług" pages describe the public-architecture version of the same mechanism:
  - [Złożenie dokumentu elektronicznego przez formularz](https://www.gov.pl/web/ia/model-realizacji-e-uslug-zlozenie-dokumentu-przez-formularz):
    form generated from a template in KWD; template "znaczniki" drive generation, default/allowed values and
    validation; fields prefilled from the auth token and other systems; the user cannot advance a step until it
    validates; forms "must be prepared by developers according to a standard covering technical aspects, UI and UX".
  - [Funkcje biznesowe](https://www.gov.pl/web/ia/model-realizacji-e-uslug-funkcje-biznesowe):
    "Publikowanie interaktywnych formularzy dla e-usług" includes reusable components, explicitly
    "widget adresu powiązany z TERYT" and a child-selection widget; an API may supply a field's value list (= dictionary).
  - [Bloki budowlane rozwiązań](https://www.gov.pl/web/ia/bloki-budowlane-rozwiazan): catalogue acronyms KWD, KUP,
    KPP, KRP, KPA; Węzeł Krajowy = login.gov.pl; "Mój Gov" hosts e-service forms. No "Platforma e-usług" block
    beyond a segment label.
- Press: COI director announced "Multiportal RP" (one gov.pl entry point with AI guidance) and a PLLuM-based
  assistant for gov.pl/mObywatel ([bezprawnik](https://bezprawnik.pl/polacy-beda-mogli-zalatwiac-sprawy-urzedowe-w-nowy-sposob/),
  [xyz.pl](https://xyz.pl/mobywatel-uzbroi-sie-w-sztuczna-inteligencje-beda-tez-nowe-m-uslugi/)) [reported]. Useful
  for the "potencjał wdrożeniowy" slide, not for format rules.
- HackNation 2026: 21–22 Nov, Bydgoszcz, 15 tasks ([gov.pl](https://www.gov.pl/web/cyfryzacja/hacknation-2026-zaczyna-sie-od-dobrego-wyzwania-za-nami-warsztaty-dla-instytucji-publicznych),
  [chip.pl](https://www.chip.pl/2026/11/hacknation-wraca-do-bydgoszczy-w-dobe-powstana-pomysly-na-sprawniejsze-panstwo)). The COI task text is not online.
- **Dictionaries** `TERYT_DOWODOWY`, `TERYT_4G_DOWODOWY`: no hits anywhere [reported]. Observed in golden [measured]:
  used only as SELECT with `title == dictionaryName`, techName `wojewodztwo`, `wojewodztwo_siedziba`,
  `wojewodztwo_inna_osoba`; 05 sets `searchEnabled: true, multiLevelTree: true` on every TERYT select, 01 only on
  the first. One SELECT replaces the four separate Województwo/Powiat/Gmina/Miejscowość dictionaries from
  `Słowniki.docx`. Interpretation [guess]: "4G" = 4-level tree (woj > powiat > gmina > miejscowość),
  "DOWODOWY" = the address dictionary variant used by Rejestr Dowodów Osobistych / ewidencja ludności. Both names
  are accepted by the importer (both appear in COI-produced files). Pick `TERYT_4G_DOWODOWY` as default.
- Other dictionary names seen or documented: `Kraje` (default `["Polska"]`, `searchEnabled: true`),
  `Numery kierunkowe` (documented, unused in golden; no techName known – avoid or ask).
- ePUAP identifier rules (for the EPUAP validator) come from Dz.U. 2023 poz. 2514: "unikalny ciąg znaków
  alfanumerycznych", user-chosen, never reissued; address shape `/<identyfikator>/<skrytka>`, e.g.
  `/mnauka/SkrytkaESP` ([gov.pl](https://www.gov.pl/web/nauka/elektroniczna-skrzynka-podawcza)) [reported].

### 3.2 JSONata – semantics of the constructs in the golden files

Sources: [comparison-operators](https://docs.jsonata.org/comparison-operators), [predicate](https://docs.jsonata.org/predicate),
[boolean-functions](https://docs.jsonata.org/boolean-functions), [boolean-operators](https://docs.jsonata.org/boolean-operators),
[path-operators](https://docs.jsonata.org/path-operators), [programming](https://docs.jsonata.org/programming).

- `lhs in rhs`: true if lhs is among the values of rhs; "if the RHS is a single value, then it is treated as a
  singleton array" [reported]. So `"Polska" in __userAnswer` works whether the runtime stores a string or an array.
- `[expr]` predicate: evaluated per item, cast with `$boolean` rules; integer -> index. Singleton/array
  equivalence means `tabs['Dane' in title]` yields the tab object, not an array [reported].
- `'Dane' in title` on a string title is **equality**, not substring [measured]: tab "Dane do kontaktu" does not
  match. Tab titles used in queries must be reproduced exactly (incl. diacritics, e.g. `'Informacje o nadpłacie'`).
- `$not(arg)` casts first; `$boolean` of an empty array/`null`/`""`/no-match is false, so `$not(<no answer>)` is
  **true** [measured]. Consequence: a "foreign address" field guarded by `$not("Polska" in ...)` is visible until
  the user picks a country, unless the SELECT has a default. Always give `kraj` the default `["Polska"]`.
- `and` / `or` cast operands with `$boolean`; docs give no precedence table [reported]. Golden style: every
  `in` term wrapped in `( ... )`, newlines allowed. Keep that style; the parser accepts multi-line text [measured].
- Variables `$name`; `$` = context, `$$` = root. `$repeatingSectionIndex` is a **COI-injected binding**, not a
  JSONata built-in; unbound it evaluates to `None`, no error [measured]; `Jsonata.assign("repeatingSectionIndex", i)`
  binds it for tests. Repeating-section form (from the rules doc):
  `"Opcja 1" in tabs['Strona 1' in title].questions['sekcja_1' in field.techName].field.__userAnswer[$repeatingSectionIndex]['pole_1' in fieldTechName].answers`
  Note the different shape: `__userAnswer[index][...]` with `fieldTechName` / `answers`, not `repeatingSectionGrid`.
- Runtime data shape implied by the queries [guess, consistent with measured eval]:
  `{tabs:[{title, questions:[{field:{techName, repeatingSectionGrid:[{field:{techName, __userAnswer}}]}}]}]}`.
  A query that references a `techName` or tab title that does not exist evaluates to `false`/`true` silently, so
  the linter must do the cross-reference check statically.
- Linter spec (to implement in `src/`): (1) `jsonata.Jsonata(q)` parse; (2) regex-extract
  `tabs['<T>' in title]`, `questions['<S>' in field.techName]`, `repeatingSectionGrid['<F>' in field.techName]`,
  and the literal before `in`; assert T is a tab title in the file, S a SECTION/REPEATING_SECTION techName in that
  tab, F a field in S, and the literal is one of F's `options[].name` (or `Polska` for `Kraje`); (3) evaluate against
  a synthetic answer set to smoke-test (`True`/`False`, never exception).

### 3.3 Initial data sources (PESEL, PESEL_ADDRESS, MLPZ)

- Only source: `docs/materialy/dane_inicjalne.txt` (COI PDF). Attribute names are not published anywhere else
  [reported: searches on gov.pl/COI returned nothing for "MLPZ"]. Most plausible expansion [guess]: a COI login/
  profile module fed by Węzeł Krajowy (login.gov.pl) – attributes `name, secondName, surname, pesel, phoneNumber,
  email, country, voivodeship, district, community, place, postCode, street, building, apartment, institutionName,
  descriptiveOrganizationName`. The Węzeł Krajowy integration doc v3.7 (2026-03-23, MC/COI,
  [gov.pl attachment](https://www.gov.pl/attachment/9ae72f17-b48c-4593-8139-5f5dbfa639a5)) is SAML-level and does
  not name MLPZ.
- Rules to encode: readOnly + `defaultValue: "<SRC>.<attr>"` + `defaultValueType: "EXTERNAL_SYSTEM"`; exactly one
  source/attribute per field; `PESEL.birthDate` -> DATEPICKER, everything else TEXT_FIELD. Golden mixes sources:
  identity from `MLPZ.*` (01) or `PESEL.*` (05), address + contact always `MLPZ.*`. Note: golden address fields
  `kod_pocztowy/ulica/numer_budynku/numer_lokalu` have `defaultValueType: EXTERNAL_SYSTEM` **without** `readOnly`
  (user may edit) – copy that, it is the reference behaviour, even though the PDF says readOnly.
- `PESEL_ADDRESS.*` (permanent/temporary registered address) is unused in golden; offer it only when the paper
  form asks for "adres zameldowania" explicitly.

### 3.4 Polish validators – algorithms (all verified in `docs/research/spikes/03_validators_check.py`) [measured]

| Validator | Regex (format) | Checksum rule | Source |
|---|---|---|---|
| `PESEL` | `^\d{11}$` | weights 1,3,7,9,1,3,7,9,1,3 on d1..d10; check = (10 − S mod 10) mod 10 == d11. Month +20/+40/+60/+80 encodes century; d10 odd = male | [pl.wikipedia PESEL](https://pl.wikipedia.org/wiki/PESEL) |
| `NIP` | `^\d{10}$` (strip `-`) | weights 6,5,7,2,3,4,5,6,7 on d1..d9; S mod 11 == d10; remainder 10 never valid | [pl.wikipedia NIP](https://pl.wikipedia.org/wiki/NIP) |
| `REGON` | `^(\d{9}\|\d{14})$` | 9: weights 8,9,2,3,4,5,6,7, S mod 11 (10→0) == d9. 14: first 9 valid as above, then weights 2,4,8,5,0,9,7,3,6,1,2,4,8, S mod 11 (10→0) == d14 | [pl.wikipedia REGON](https://pl.wikipedia.org/wiki/REGON) |
| `SERIAL_NUMBER_ID_CARD` | `^[A-Z]{3}\d{6}$` | A=10..Z=35, digits as-is; weights 7,3,1,9,7,3,1,7,3 over all 9 chars; sum mod 10 == 0 (equivalently: 4th char is the check digit). Example ZZC108201 → 400 | [interia](https://biznes.interia.pl/finanse/news-seria-i-numer-dowodu-osobistego-jakie-informacje-kryja-w-sob,nId,6699449), [CSP Legionowo PDF](https://www.csp.edu.pl/download/6/16750/Dowodosobisty-zabezpieczeniastwierdzajaceautentycznosdokumentuDSledziewskinr103.pdf) ("trzech liter i sześciu cyfr, z których jedna (pierwsza cyfra) to cyfra kontrolna"), [gist](https://gist.github.com/mlask/4e80ec890f5546813f48) |
| `ZIP_CODE` | `^\d{2}-\d{3}$` | none | convention; CRD `adres.xsd` only limits length 0–10 |
| `EMAIL` | CRD: `^([0-9a-zA-Z]+[\-._+&])*[0-9a-zA-Z]+@([\-0-9a-zA-Z]+[.])+[a-zA-Z]{2,6}$` (TLD 2–6 is dated; prefer a standard RFC-ish regex) | none | [crd.gov.pl adres.xsd](https://crd.gov.pl/xml/schematy/adres/2009/11/09/adres.xsd) |
| `ADE` (e-Doręczenia) | `^AE:PL-\d{5}-\d{5}-[A-Z]{5}-\d{2}$` | last 2 digits are a checksum; **algorithm not published** (only "ZZ – cyfry oznaczające sumę kontrolną"). Real example `AE:PL-97086-47802-BUFIW-21` matches | gov.pl e-Doręczenia guide ([attachment](https://www.gov.pl/attachment/9b0b3554-d825-405c-a341-24100771d99e)), [rdos-kielce](https://www.gov.pl/web/rdos-kielce/e-doreczenia) |
| `EPUAP` | `^/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+$` [guess on charset; law says "alfanumeryczny"] | none | Dz.U. 2023 poz. 2514; examples `/MRPiT/SkrytkaESP`, `/mnauka/SkrytkaESP` |
| KRS (not in validator list) | `^\d{10}$` | none | COI standards PDF line 549 ("Dodatkowe walidatory: Pattern, Regex ^\d{10}$") – but `validation[]` has no Pattern entry; golden leaves KRS unvalidated |

Numeric checks run: PESEL 55030101193 ok / ...194 fail; NIP 1234563218 ok / 1234567890 fail; REGON 123456785 and
12345678512347 ok; ID ZZC108201 ok, ZZC208201 fail; ADE example matches.
Usage rule from golden: `validation` is **empty everywhere** in both references; emit validators only where the
field semantics are unambiguous (title contains PESEL/NIP/REGON/e-mail/kod pocztowy), plus `REQUIRED` as a
deliberate choice. Never put a validator on readOnly EXTERNAL_SYSTEM fields.

### 3.5 Standards for Polish public e-forms

- WCAG 2.1 AA is the legal baseline (ustawa z 4.04.2019, Dz.U. 2019 poz. 848); official PL translation on
  [gov.pl](https://www.gov.pl/web/cyfryzacja/wcag-21-juz-oficjalnie-po-polsku) [reported].
- [gov.pl/dostepnosc-cyfrowa/formularze](https://www.gov.pl/web/dostepnosc-cyfrowa/formularze): every field has a
  label; state the format in the label/description (e.g. date pattern); required-ness stated in words, not only
  `*`; group related fields in code and visually (our SECTION); errors as text next to the field with a fix hint;
  no colour-only signalling; forms with legal/financial effect must offer review before submit (our FINISH tab
  "Podgląd uzupełnionego wniosku") [reported].
- [Prosty język](https://www.gov.pl/web/dostepnosc-cyfrowa/prosty-jezyk): 15–20 words per sentence, 2nd person
  ("Wybierz…", "Wpisz…"), active voice, one term per concept, explain abbreviations, headings + short paragraphs
  [reported]. Golden titles follow this: "Wybierz, w czyim imieniu wnioskujesz", "Podatek, którego dotyczy nadpłata".
- No public gov.pl design system / component library exists (only internal "Design System" mentions in GOV PRESS
  CMS notes) [reported: searches]. Layout rules therefore come solely from the COI standards PDF: one column
  (`x=0, cols=3`), predefined sections, logical order (strony postępowania → sprawa → kontakt/oświadczenia →
  podsumowanie).
- "Strony alternatywne" (COI standards rule 8): use when a whole next stage depends on an answer. The JSON schema
  gives no conditional links, and tabs have no `states` → not expressible today. Practical mapping: one MAIN tab per
  alternative with every SECTION guarded by the same `SHOW` query (the engine skips an all-hidden tab? unknown –
  **ask mentor**); safe fallback is conditional SECTIONs on a shared tab, as in both golden files.

### 3.6 Reusable field vocabularies (CRD / ePUAP)

- CRD = Centralne Repozytorium Wzorów Dokumentów Elektronicznych (ustawa o informatyzacji art. 19b); templates
  published there are legally binding; schema list under ePUAP "Podmioty Publiczne > Repozytorium > Lista
  schematów" [reported]. Common types are at `crd.gov.pl/xml/schematy/...`:
  - [osoba.xsd](https://crd.gov.pl/xml/schematy/osoba/2009/11/16/osoba.xsd): `Imie` (max 30), `ImieDrugie`,
    `Nazwisko` (1–3 members, max 40), `NazwiskoRodowe`, `PESEL` `\d{11}`, `NIP` `\d{10}`, `DataUrodzenia`,
    `MiejsceUrodzenia`, `Plec` {K,M}, `RodzajDowoduTozsamosci` {dowód osobisty, paszport, prawo jazdy},
    `NrDowoduTozsamosci`, `Obywatelstwo`, `StanCywilny` enum, `Wyksztalcenie*`, `Zawod`.
  - [adres.xsd](https://crd.gov.pl/xml/schematy/adres/2009/11/09/adres.xsd): `KodPocztowy`, `Poczta`,
    `Miejscowosc` (56), `Ulica` + `rodzajUlicy` {ulica, plac, rondo, aleja, skwer, inna}, `Budynek`
    `\S{0,4}|\S{0,4}/\S{0,4}`, `Lokal`, `SkrytkaPocztowa`, `Kraj` (ISO 3166), `TERC` `\d{7}`, `SIMC` `\d{7}`,
    `ULIC` `\d{5}`, `Wojewodztwo`, `Powiat`, `Gmina`; `Kontakt`: `Telefon`, `Faks`, `Email`, `URIKontakt`.
- Use: a static synonym table paper-label → canonical techName (e.g. "Nazwisko i imię" → `imie`,`nazwisko`;
  "Nr domu" → `numer_budynku`; "Nr lokalu" → `numer_lokalu`; "Tel." → `numer_telefonu`), and as evidence that the
  golden techNames (`imie, nazwisko, numer_pesel, nip, regon, numer_krs, kod_pocztowy, ulica, numer_budynku,
  numer_lokalu, numer_telefonu, adres_e_mail`) are the conventional ones. No runtime dependency on ePUAP.

## 4. Gotchas for our constraints

- `jsonata-python` needs Python ≥3.11 for ISO date functions only; pure Python, no native deps → Docker-safe.
  Guard `evaluate()` with `timeout=` because JSONata is Turing-complete (irrelevant for our own queries, but cheap).
- Query strings must embed Polish diacritics from tab titles verbatim; JSON-escape `"` inside the query (`\"`).
  Single quotes for the predicate literals, double quotes for the compared value – match golden exactly.
- `$not(...)` guards show the field when the controlling SELECT is empty; always set `defaultValue: ["Polska"]`.
- ADE and ePUAP validators are format-only; do not claim checksum validation for ADE in the demo.
- ID-card regex: letters must be upper-case ASCII; normalise input before checking.
- Dictionary names are case-sensitive strings the importer looks up; never invent new ones silently – the task
  allows proposing a new dictionary (e.g. "Dyscypliny sportowe" for form 09) but mark it as a proposal in output.
- KRS: standards PDF wants `^\d{10}$` but `validation[]` has no Pattern validator → leave `validation: []` and
  put the format in `description`/`tooltipMessage`.

## 5. Concrete next step (30-minute spike)

```bash
cd /Users/mateuszkin/.t3/projects/hacknation-cyfr-forumla
uv add jsonata-python            # Apache-2.0, pure Python
# 1. lint all states[].query in golden + our outputs
python - <<'EOF'
import json, glob, re, jsonata
from jsonata.jexception import JException
REF = re.compile(r"tabs\['([^']+)' in title\]\.questions\['([^']+)' in field\.techName\]\.field\.repeatingSectionGrid\['([^']+)' in field\.techName\]")
for f in glob.glob("data/input/02_przyklady_json/*.json"):
    d = json.load(open(f)); tabs = {t["title"]: t for t in d["tabs"]}
    def walk(o):
        if isinstance(o, dict):
            for s in o.get("states") or []:
                q = s["query"]
                try: jsonata.Jsonata(q)
                except JException as e: print("SYNTAX", f, e)
                for tab, sec, fld in REF.findall(q):
                    secs = {qq["field"]["techName"]: qq["field"] for qq in tabs[tab]["questions"]}
                    assert fld in {x["field"]["techName"] for x in secs[sec]["repeatingSectionGrid"]}, (f, tab, sec, fld)
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(d); print("ok", f)
EOF
# 2. port scratchpad/checks.py into src/<pkg>/validators.py with pytest cases from section 3.4
```

Reference scripts from this research: `docs/research/spikes/03_jsonata_spike.py` (JSONata semantics, run with `python -I <script> data/input/02_przyklady_json`), `docs/research/spikes/03_validators_check.py`
(checksums) – copy into `src/` and `tests/` rather than re-deriving.
