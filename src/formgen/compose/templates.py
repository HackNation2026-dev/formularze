"""Template sections from 'Standardy i dobre praktyki projektowania formularzy', shaped like the golden files."""

from __future__ import annotations

from formgen.compose import jsonata as jq
from formgen.compose.builders import consent_section, field, section, show, text
from formgen.schema.model import FieldType, Question, Validator

DANE = "Dane"
PODMIOT = "podmiot_wniosku"
F_IMIENIU = "wybierz_w_czyim_imieniu_wnioskujesz"
F_JAKO = "wybierz_jako_kto_wnioskujesz"
OPT_SWOIM = "Swoim"
OPT_INNEJ = "Innej osoby"
OPT_PRAWNEJ = "Osoby prawnej lub jednostki organizacyjnej"
OPT_PELNOMOCNIK = "Pełnomocnik"
OPT_REPREZENTANT = "Reprezentant"
KRAJE = "Kraje"
TERYT = "TERYT_4G_DOWODOWY"

TXT_PELNOMOCNICTWO = "Dodaj dokument potwierdzający, że jesteś pełnomocnikiem."
TXT_REPREZENTANT = (
    "Dołącz aktualny odpis danych z Krajowego Rejestru Sądowego lub innego rejestru. "
    "Odpis powinien potwierdzać, że jesteś reprezentantem podmiotu lub instytucji."
)
TXT_OPLATA_INTRO = (
    "Nie musisz płacić za złożenie pełnomocnictwa wystawionego przez najbliższą rodzinę: "
    "małżonka, dzieci, rodziców, dziadków, wnuków, rodzeństwo. Więcej informacji na stronie "
    '<a href="https://www.biznes.gov.pl/pl/portal/0089#8" rel="noopener noreferrer" target="_blank">biznes.gov.pl</a>'
)


def txt_oplata_info(form_title: str, siedziba: bool) -> str:
    kto = "siedziby podmiotu, który udzielił" if siedziba else "zamieszkania osoby, która udzieliła"
    return (
        "Opłata skarbowa za pełnomocnictwo wynosi <strong>17 zł</strong>.\n"
        f"Przelej ją na konto urzędu miasta lub gminy właściwego dla adresu {kto} pełnomocnictwa. "
        "Jeśli adres nie jest w Polsce, opłatę przelej na konto "
        '<a href="https://warszawa19115.pl/-/oplata-skarbowa" rel="noopener noreferrer" target="_blank">'
        "Urzędu Miasta Stołecznego Warszawy – Centrum Obsługi Podatnika</a>.\n"
        f"W tytule przelewu wpisz „{form_title} – opłata skarbowa za pełnomocnictwo”.\n"
        "Dodaj plik z potwierdzeniem przelewu. Znajdziesz go na stronie lub w aplikacji swojego banku."
    )


TXT_KONTAKT = (
    "Wpisanie danych do kontaktu może przyspieszyć załatwienie sprawy. Urzędnik będzie mógł "
    "skontaktować się z Tobą w przypadku pytań lub wątpliwości.\n"
    "Jeśli widzisz uzupełnione dane, sprawdź, czy są poprawne. Możesz je zmienić lub usunąć."
)
TXT_ZGODA = (
    "Wyrażam zgodę na przetwarzanie moich danych osobowych zgodnie z "
    '<a href="#klauzula-informacyjna" rel="noopener noreferrer" target="_blank">klauzulą informacyjną</a>'
)
TXT_PODGLAD = (
    "Zanim przejdziesz do wyboru sposobu podpisu, sprawdź dane na podglądzie. Jeśli zobaczysz błędy, wróć do edycji."
)


def _req(v: bool, *extra: Validator) -> list[Validator]:
    return ([Validator.REQUIRED] if v else []) + list(extra)


# ---- conditions on 'Podmiot wniosku' -------------------------------------------------------
def cond_imieniu(value: str) -> str:
    return jq.equals(DANE, PODMIOT, F_IMIENIU, value)


def cond_jako(value: str) -> str:
    return jq.equals(DANE, PODMIOT, F_JAKO, value)


COND_INNEJ = cond_imieniu(OPT_INNEJ)
COND_PRAWNEJ = cond_imieniu(OPT_PRAWNEJ)
COND_PRAWNEJ_PELNOMOCNIK = jq.all_of(COND_PRAWNEJ, cond_jako(OPT_PELNOMOCNIK))
COND_PRAWNEJ_REPREZENTANT = jq.all_of(COND_PRAWNEJ, cond_jako(OPT_REPREZENTANT))


# ---- sections --------------------------------------------------------------------------------
def sec_urzad(office_name: str, organ: bool, v: bool) -> Question:
    if organ:
        return section(
            "organ_do_ktorego_jest_skladany_wniosek",
            "Organ, do którego jest składany wniosek",
            [text("nazwa_organu", "Nazwa organu", read_only=True, default=office_name, validation=_req(v))],
        )
    return section(
        "urzad_do_ktorego_jest_skladany_wniosek",
        "Urząd, do którego jest składany wniosek",
        [text("nazwa_urzedu", "Nazwa urzędu", read_only=True, default=office_name, validation=_req(v))],
    )


def sec_podmiot(self_person: bool, other: bool, legal: bool, v: bool) -> Question:
    opts = [o for o, on in ((OPT_SWOIM, self_person), (OPT_INNEJ, other), (OPT_PRAWNEJ, legal)) if on]
    fields = [
        field(FieldType.RADIO, F_IMIENIU, "Wybierz, w czyim imieniu wnioskujesz", options=opts, validation=_req(v))
    ]
    if legal:
        fields.append(
            field(
                FieldType.RADIO,
                F_JAKO,
                "Wybierz, jako kto wnioskujesz",
                options=[OPT_PELNOMOCNIK, OPT_REPREZENTANT],
                validation=_req(v),
                states=[show(COND_PRAWNEJ)],
            )
        )
    return section(PODMIOT, "Podmiot wniosku", fields)


def sec_twoje_dane(source: str, pesel: bool, v: bool) -> Question:
    fields = [
        text("imie", "Imię", read_only=True, external=f"{source}.name", validation=_req(v)),
        text("nazwisko", "Nazwisko", read_only=True, external=f"{source}.surname", validation=_req(v)),
    ]
    if pesel:
        fields.append(
            text(
                "numer_pesel",
                "Numer PESEL",
                read_only=True,
                external=f"{source}.pesel",
                validation=_req(v, Validator.PESEL),
            )
        )
    return section("twoje_dane", "Twoje dane", fields)


def sec_adres(
    tech: str, title: str, suffix: str, v: bool, *, mlpz: bool = False, states: list | None = None
) -> Question:
    kraj = f"kraj{suffix}"
    pl = show(jq.equals(DANE, tech, kraj, "Polska"))
    abroad = show(jq.not_equals(DANE, tech, kraj, "Polska"))
    ext = (lambda a: f"MLPZ.{a}") if mlpz else (lambda a: None)
    fields = [
        field(
            FieldType.SELECT,
            kraj,
            "Kraj",
            dictionary=KRAJE,
            default=["Polska"],
            search=True,
            multi_level=False,
            validation=_req(v),
        ),
        text(f"miejscowosc{suffix}_zagranica", "Miejscowość", states=[abroad], validation=_req(v)),
        text(f"kod_pocztowy{suffix}_zagranica", "Kod pocztowy", states=[abroad], validation=_req(v)),
        text(f"ulica{suffix}_zagranica", "Ulica", states=[abroad], validation=_req(v)),
        field(
            FieldType.SELECT,
            f"wojewodztwo{suffix}",
            TERYT,
            dictionary=TERYT,
            search=True,
            multi_level=True,
            states=[pl],
            validation=_req(v),
        ),
        text(
            f"kod_pocztowy{suffix}",
            "Kod pocztowy",
            states=[pl],
            external=ext("postCode"),
            validation=_req(v, Validator.ZIP_CODE),
        ),
        text(f"ulica{suffix}", "Ulica", states=[pl], external=ext("street"), validation=_req(v)),
        text(f"numer_budynku{suffix}", "Numer budynku", external=ext("building"), validation=_req(v)),
        text(f"numer_lokalu{suffix}", "Numer lokalu", external=ext("apartment")),
    ]
    return section(tech, title, fields, states=states)


def sec_dane_podmiotu(v: bool) -> Question:
    return section(
        "dane_podmiotu",
        "Dane podmiotu",
        [
            text("nazwa", "Nazwa", validation=_req(v)),
            text("nip", "NIP", validation=_req(v, Validator.NIP)),
            text("regon", "REGON", validation=_req(v, Validator.REGON)),
            text("numer_krs", "Numer KRS", description="Wpisz 10 cyfr."),
        ],
        states=[show(COND_PRAWNEJ)],
    )


def sec_reprezentant(v: bool) -> Question:
    return section(
        "potwierdzenie_ze_jestes_reprezentantem",
        "Potwierdzenie, że jesteś reprezentantem",
        [field(FieldType.FILE_UPLOADER, "plik_z_odpisem_danych", "Plik z odpisem danych", validation=_req(v))],
        description=TXT_REPREZENTANT,
        states=[show(COND_PRAWNEJ_REPREZENTANT)],
    )


def sec_dane_innej_osoby(v: bool) -> Question:
    return section(
        "dane_innej_osoby",
        "Dane innej osoby",
        [
            text("imie_inna_osoba", "Imię", validation=_req(v)),
            text("nazwisko_inna_osoba", "Nazwisko", validation=_req(v)),
            text("numer_pesel_inna_osoba", "Numer PESEL", validation=_req(v, Validator.PESEL)),
        ],
        states=[show(COND_INNEJ)],
    )


def sec_pelnomocnictwo(other: bool, legal: bool, v: bool) -> Question:
    conds = [c for c, on in ((COND_INNEJ, other), (COND_PRAWNEJ_PELNOMOCNIK, legal)) if on]
    return section(
        "pelnomocnictwo",
        "Pełnomocnictwo",
        [
            field(
                FieldType.FILE_UPLOADER,
                "plik_dokumentu_z_pelnomocnictwem",
                "Plik dokumentu z pełnomocnictwem",
                validation=_req(v),
            )
        ],
        description=TXT_PELNOMOCNICTWO,
        states=[show(jq.any_of(*conds))],
    )


def sec_oplata_v1(form_title: str, v: bool) -> Question:
    tech = "oplata_skarbowa_pelnomocnictwo_1"
    radio = "czy_zlozenie_pelnomocnictwa_wymaga_oplaty_skarbowej"
    tak = show(jq.equals(DANE, tech, radio, "Tak"))
    return section(
        tech,
        "Opłata skarbowa",
        [
            field(
                FieldType.RADIO,
                radio,
                "Czy złożenie pełnomocnictwa wymaga opłaty skarbowej?",
                options=["Tak", "Nie"],
                validation=_req(v),
            ),
            field(FieldType.TEXT_BLOCK, "oplata_info_1", description=txt_oplata_info(form_title, False), states=[tak]),
            field(
                FieldType.FILE_UPLOADER,
                "plik_z_potwierdzeniem_przelewu",
                "Plik z potwierdzeniem przelewu",
                states=[tak],
                validation=_req(v),
            ),
        ],
        description=TXT_OPLATA_INTRO,
        states=[show(COND_INNEJ)],
    )


def sec_oplata_v2(form_title: str, v: bool) -> Question:
    return section(
        "oplata_skarbowa_pelnomocnictwo_2",
        "Opłata skarbowa za pełnomocnictwo",
        [
            field(FieldType.TEXT_BLOCK, "oplata_info", description=txt_oplata_info(form_title, True)),
            field(
                FieldType.FILE_UPLOADER,
                "plik_z_potwierdzeniem_przelewu_2",
                "Plik z potwierdzeniem przelewu",
                validation=_req(v),
            ),
        ],
        states=[show(COND_PRAWNEJ_PELNOMOCNIK)],
    )


def sec_kontakt(v: bool) -> Question:
    return section(
        "dane_do_kontaktu",
        "Dane do kontaktu",
        [
            text("numer_telefonu", "Numer telefonu", external="MLPZ.phoneNumber"),
            text("adres_e_mail", "Adres e-mail", external="MLPZ.email", validation=[Validator.EMAIL] if v else []),
        ],
        description=TXT_KONTAKT,
    )


def sec_zgoda(extra: list[tuple[str, bool]]) -> Question:
    consents = [(TXT_ZGODA, True), *list(extra)]
    title = "Zgody i oświadczenia" if extra else "Zgoda"
    return section("zgoda_wyrazenie", title, [consent_section("zgoda", consents)])


def sec_podglad(summary: str) -> list[Question]:
    out: list[Question] = []
    if summary:
        out.append(
            section(
                "podsumowanie", "Podsumowanie", [field(FieldType.TEXT_BLOCK, "podsumowanie_1", description=summary)]
            )
        )
    out.append(
        section(
            "podglad_uzupelnionego_wniosku",
            "Podgląd uzupełnionego wniosku",
            [field(FieldType.TEXT_BLOCK, "podglad_1", description=TXT_PODGLAD)],
        )
    )
    return out
