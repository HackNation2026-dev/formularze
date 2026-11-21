---
wersja: 0.4.0
aktualizacja: 2026-11-21
status: implementacja
---

# 01_numer_porzadkowy_nieruchomosci: Wniosek o ustalenie numeru porządkowego nieruchomości

## tab MAIN "Dane" id=7d4cff8e-8fd5-440d-bb8f-1fe6d0a339ff

- SECTION `organ_do_ktorego_jest_skladany_wniosek` "Organ, do którego jest składany wniosek" [x0 y0 r2 c3] ord=0
  - TEXT_FIELD `nazwa_organu` "Nazwa organu" [x0 y0 r1 c3] ord=0 readOnly default='Wójt Gminy Elbląg' type=None
- SECTION `podmiot_wniosku` "Podmiot wniosku" [x0 y2 r3 c3] ord=2
  - RADIO `wybierz_w_czyim_imieniu_wnioskujesz` "Wybierz, w czyim imieniu wnioskujesz" [x0 y0 r1 c3] ord=0 opts=Swoim|Innej osoby|Osoby prawnej lub jednostki organizacyjnej
  - RADIO `wybierz_jako_kto_wnioskujesz` "Wybierz, jako kto wnioskujesz" [x0 y1 r1 c3] ord=1 opts=Pełnomocnik|Reprezentant
    - state SHOW: `("Osoby prawnej lub jednostki organizacyjnej" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_w_czyim_imieniu_wnioskujesz' in field.techName].field.__userAnswer)`
- SECTION `twoje_dane` "Twoje dane" [x0 y5 r3 c3] ord=5
  - TEXT_FIELD `imie` "Imię" [x0 y0 r1 c3] ord=0 readOnly default='MLPZ.name' type='EXTERNAL_SYSTEM'
  - TEXT_FIELD `nazwisko` "Nazwisko" [x0 y1 r1 c3] ord=1 readOnly default='MLPZ.surname' type='EXTERNAL_SYSTEM'
- SECTION `adres_zamieszkania` "Adres zamieszkania" [x0 y8 r9 c3] ord=8
  - SELECT `kraj` "Kraj" [x0 y0 r1 c3] ord=0 dict=Kraje default=['Polska'] type=None
  - TEXT_FIELD `miejscowosc_zagranica` "Miejscowość" [x0 y1 r1 c3] ord=1
    - state SHOW: `$not("Polska" in tabs['Dane' in title].questions['adres_zamieszkania' in field.techName].field.repeatingSectionGrid['kraj' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `kod_pocztowy_zagranica` "Kod pocztowy" [x0 y2 r1 c3] ord=2
    - state SHOW: `$not("Polska" in tabs['Dane' in title].questions['adres_zamieszkania' in field.techName].field.repeatingSectionGrid['kraj' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `ulica_zagranica` "Ulica" [x0 y3 r1 c3] ord=3
    - state SHOW: `$not("Polska" in tabs['Dane' in title].questions['adres_zamieszkania' in field.techName].field.repeatingSectionGrid['kraj' in field.techName].field.__userAnswer)`
  - SELECT `wojewodztwo` "TERYT_DOWODOWY" [x0 y4 r1 c3] ord=4 dict=TERYT_DOWODOWY searchEnabled=True multiLevelTree=True
    - state SHOW: `("Polska" in tabs['Dane' in title].questions['adres_zamieszkania' in field.techName].field.repeatingSectionGrid['kraj' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `kod_pocztowy` "Kod pocztowy" [x0 y5 r1 c3] ord=5 default='MLPZ.postCode' type='EXTERNAL_SYSTEM'
    - state SHOW: `("Polska" in tabs['Dane' in title].questions['adres_zamieszkania' in field.techName].field.repeatingSectionGrid['kraj' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `ulica` "Ulica" [x0 y6 r1 c3] ord=6 default='MLPZ.street' type='EXTERNAL_SYSTEM'
    - state SHOW: `("Polska" in tabs['Dane' in title].questions['adres_zamieszkania' in field.techName].field.repeatingSectionGrid['kraj' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `numer_budynku` "Numer budynku" [x0 y7 r1 c3] ord=7 default='MLPZ.building' type='EXTERNAL_SYSTEM'
  - TEXT_FIELD `numer_lokalu` "Numer lokalu" [x0 y8 r1 c3] ord=8 default='MLPZ.apartment' type='EXTERNAL_SYSTEM'
- SECTION `dane_podmiotu` "Dane podmiotu" [x0 y17 r5 c3] ord=17
  - state SHOW: `("Osoby prawnej lub jednostki organizacyjnej" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_w_czyim_imieniu_wnioskujesz' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `nazwa` "Nazwa" [x0 y0 r1 c3] ord=0
  - TEXT_FIELD `nip` "NIP" [x0 y1 r1 c3] ord=1
  - TEXT_FIELD `regon` "REGON" [x0 y2 r1 c3] ord=2
  - TEXT_FIELD `numer_krs` "Numer KRS" [x0 y3 r1 c3] ord=3
- SECTION `adres_siedziby` "Adres siedziby" [x0 y22 r8 c3] ord=22
  - state SHOW: `("Osoby prawnej lub jednostki organizacyjnej" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_w_czyim_imieniu_wnioskujesz' in field.techName].field.__userAnswer)`
  - SELECT `kraj_siedziba` "Kraj" [x0 y0 r1 c3] ord=0 dict=Kraje default=['Polska'] type=None multiLevelTree=False
  - TEXT_FIELD `miejscowosc_siedziba_zagranica` "Miejscowość" [x0 y1 r1 c3] ord=1
    - state SHOW: `$not("Polska" in tabs['Dane' in title].questions['adres_siedziby' in field.techName].field.repeatingSectionGrid['kraj_siedziba' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `kod_pocztowy_siedziba_zagranica` "Kod pocztowy" [x0 y2 r1 c3] ord=2
    - state SHOW: `$not("Polska" in tabs['Dane' in title].questions['adres_siedziby' in field.techName].field.repeatingSectionGrid['kraj_siedziba' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `ulica_siedziba_zagranica` "Ulica" [x0 y3 r1 c3] ord=3
    - state SHOW: `$not("Polska" in tabs['Dane' in title].questions['adres_siedziby' in field.techName].field.repeatingSectionGrid['kraj_siedziba' in field.techName].field.__userAnswer)`
  - SELECT `wojewodztwo_siedziba` "TERYT_4G_DOWODOWY" [x0 y4 r1 c3] ord=4 dict=TERYT_4G_DOWODOWY
    - state SHOW: `("Polska" in tabs['Dane' in title].questions['adres_siedziby' in field.techName].field.repeatingSectionGrid['kraj_siedziba' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `kod_pocztowy_siedziba` "Kod pocztowy" [x0 y5 r1 c3] ord=5
    - state SHOW: `("Polska" in tabs['Dane' in title].questions['adres_siedziby' in field.techName].field.repeatingSectionGrid['kraj_siedziba' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `ulica_siedziba` "Ulica" [x0 y6 r1 c3] ord=6
    - state SHOW: `("Polska" in tabs['Dane' in title].questions['adres_siedziby' in field.techName].field.repeatingSectionGrid['kraj_siedziba' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `numer_budynku_siedziba` "Numer budynku" [x0 y7 r1 c3] ord=7
  - TEXT_FIELD `numer_lokalu_siedziba` "Numer lokalu" [x0 y8 r1 c3] ord=8
- SECTION `potwierdzenie_ze_jestes_reprezentantem` "Potwierdzenie, że jesteś reprezentantem" [x0 y30 r2 c3] ord=30 desc='<html><head></head><body><p><span style="background-color: rgb(255, 255, 255); color: rgb(31, 35, 40);">Dołącz aktualny '
  - state SHOW: `("Osoby prawnej lub jednostki organizacyjnej" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_w_czyim_imieniu_wnioskujesz' in field.techName].field.__userAnswer)
and
("Reprezentant" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_jako_kto_wnioskujesz' in field.techName].field.__userAnswer)`
  - FILE_UPLOADER `plik_z_odpisem_danych` "Plik z odpisem danych" [x0 y0 r1 c3] ord=0
- SECTION `dane_innej_osoby` "Dane innej osoby" [x0 y32 r3 c3] ord=32
  - state SHOW: `("Innej osoby" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_w_czyim_imieniu_wnioskujesz' in field.techName].field.__userAnswer)
`
  - TEXT_FIELD `imie_inna_osoba` "Imię" [x0 y0 r1 c3] ord=0
  - TEXT_FIELD `nazwisko_inna_osoba` "Nazwisko" [x0 y1 r1 c3] ord=1
- SECTION `adres_zamieszkania_osoby_ktorej_jestes_pelnomocnikiem` "Adres zamieszkania innej osoby" [x0 y35 r9 c3] ord=35
  - state SHOW: `("Innej osoby" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_w_czyim_imieniu_wnioskujesz' in field.techName].field.__userAnswer)
`
  - SELECT `kraj_inna_osoba` "Kraj" [x0 y0 r1 c3] ord=0 dict=Kraje default=['Polska'] type=None multiLevelTree=False
  - TEXT_FIELD `miejscowosc_inna_osoba_zagranica` "Miejscowość" [x0 y1 r1 c3] ord=1
    - state SHOW: `$not("Polska" in tabs['Dane' in title].questions['adres_zamieszkania_osoby_ktorej_jestes_pelnomocnikiem' in field.techName].field.repeatingSectionGrid['kraj_inna_osoba' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `kod_pocztowy_inna_osoba_zagranica` "Kod pocztowy" [x0 y2 r1 c3] ord=2
    - state SHOW: `$not("Polska" in tabs['Dane' in title].questions['adres_zamieszkania_osoby_ktorej_jestes_pelnomocnikiem' in field.techName].field.repeatingSectionGrid['kraj_inna_osoba' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `ulica_inna_osoba_zagranica` "Ulica" [x0 y3 r1 c3] ord=3
    - state SHOW: `$not("Polska" in tabs['Dane' in title].questions['adres_zamieszkania_osoby_ktorej_jestes_pelnomocnikiem' in field.techName].field.repeatingSectionGrid['kraj_inna_osoba' in field.techName].field.__userAnswer)`
  - SELECT `wojewodztwo_inna_osoba` "TERYT_4G_DOWODOWY" [x0 y4 r1 c3] ord=4 dict=TERYT_4G_DOWODOWY
    - state SHOW: `("Polska" in tabs['Dane' in title].questions['adres_zamieszkania_osoby_ktorej_jestes_pelnomocnikiem' in field.techName].field.repeatingSectionGrid['kraj_inna_osoba' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `kod_pocztowy_inna_osoba` "Kod pocztowy" [x0 y5 r1 c3] ord=5
    - state SHOW: `("Polska" in tabs['Dane' in title].questions['adres_zamieszkania_osoby_ktorej_jestes_pelnomocnikiem' in field.techName].field.repeatingSectionGrid['kraj_inna_osoba' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `ulica_inna_osoba` "Ulica" [x0 y6 r1 c3] ord=6
    - state SHOW: `("Polska" in tabs['Dane' in title].questions['adres_zamieszkania_osoby_ktorej_jestes_pelnomocnikiem' in field.techName].field.repeatingSectionGrid['kraj_inna_osoba' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `numer_budynku_inna_osoba` "Numer budynku" [x0 y7 r1 c3] ord=7
  - TEXT_FIELD `numer_lokalu_inna_osoba` "Numer lokalu" [x0 y8 r1 c3] ord=8
- SECTION `pelnomocnictwo` "Pełnomocnictwo" [x0 y44 r2 c3] ord=44 desc='<html><head></head><body><p><span style="background-color: rgb(255, 255, 255); color: rgb(31, 35, 40);">Dodaj dokument p'
  - state SHOW: `("Innej osoby" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_w_czyim_imieniu_wnioskujesz' in field.techName].field.__userAnswer)

or 

(

("Osoby prawnej lub jednostki organizacyjnej" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_w_czyim_imieniu_wnioskujesz' in field.techName].field.__userAnswer)

and 

("Pełnomocnik" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_jako_kto_wnioskujesz' in field.techName].field.__userAnswer)


)`
  - FILE_UPLOADER `dokument_z_potwierdzeniem_podpisany_elektronicznie` "Dokument z potwierdzeniem, podpisany elektronicznie" [x0 y0 r1 c3] ord=0
- SECTION `oplata_skarbowa_pelnomocnictwo_1` "Opłata skarbowa" [x0 y46 r4 c3] ord=46 desc='<html><head></head><body><p><span style="background-color: rgb(255, 255, 255); color: rgb(31, 35, 40);">Nie musisz płaci'
  - state SHOW: `("Innej osoby" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_w_czyim_imieniu_wnioskujesz' in field.techName].field.__userAnswer)
`
  - RADIO `czy_zlozenie_pelnomocnictwa_wymaga_oplaty_skarbowej` "Czy złożenie pełnomocnictwa wymaga opłaty skarbowej?" [x0 y0 r1 c3] ord=0 opts=Tak|Nie
  - TEXT_BLOCK `oplata_info_1` "" [x0 y1 r1 c3] ord=1 desc='<html><head></head><body><p>Opłata skarbowa za pełnomocnictwo wynosi\xa0<strong>17 zł</strong>.</p><p>Przelej ją na konto u'
    - state SHOW: `("Tak" in tabs['Dane' in title].questions['oplata_skarbowa_pelnomocnictwo_1' in field.techName].field.repeatingSectionGrid['czy_zlozenie_pelnomocnictwa_wymaga_oplaty_skarbowej' in field.techName].field.__userAnswer)`
  - FILE_UPLOADER `potwierdzenie_przelewu` "Potwierdzenie przelewu" [x0 y2 r1 c3] ord=2
    - state SHOW: `("Tak" in tabs['Dane' in title].questions['oplata_skarbowa_pelnomocnictwo_1' in field.techName].field.repeatingSectionGrid['czy_zlozenie_pelnomocnictwa_wymaga_oplaty_skarbowej' in field.techName].field.__userAnswer)`
- SECTION `oplata_skarbowa_pelnomocnictwo_2` "Opłata skarbowa za pełnomonictwo" [x0 y50 r3 c3] ord=50
  - state SHOW: `("Osoby prawnej lub jednostki organizacyjnej" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_w_czyim_imieniu_wnioskujesz' in field.techName].field.__userAnswer)

and 

("Pełnomocnik" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_jako_kto_wnioskujesz' in field.techName].field.__userAnswer)`
  - TEXT_BLOCK `oplata_info` "" [x0 y0 r1 c3] ord=0 desc='<html><head></head><body><p>Opłata skarbowa za pełnomocnictwo wynosi\xa0<strong>17 zł</strong>.</p><p>Przelej ją na konto u'
  - FILE_UPLOADER `potwierdzenie_przelewu_2` "Potwierdzenie przelewu" [x0 y1 r1 c3] ord=1

## tab MAIN "Informacje o budynku" id=455397a7-3d93-48d6-9528-19c18aafe2e9

- SECTION `lokalizacja_budynku` "Lokalizacja budynku" [x0 y0 r5 c3] ord=0
  - TEXT_FIELD `miejscowosc` "Miejscowość" [x0 y0 r1 c3] ord=0
  - TEXT_FIELD `ulica_budynku` "Ulica" [x0 y1 r1 c3] ord=1
  - TEXT_FIELD `numer_ewidencyjny_dzialki` "Numer ewidencyjny działki" [x0 y2 r1 c3] ord=2
  - TEXT_FIELD `obreb_numer` "Obręb" [x0 y3 r1 c3] ord=3

## tab MAIN "Kontakt z urzędem" id=c7cbcee3-4683-4378-94c9-3d14962c71c4

- SECTION `dane_do_kontaktu` "Dane do kontaktu" [x0 y0 r3 c3] ord=0 desc='<html><head></head><body><p><span style="background-color: rgba(0, 0, 0, 0); color: rgb(57, 57, 57);">Wpisanie danych do'
  - TEXT_FIELD `numer_telefonu` "Numer telefonu" [x0 y0 r1 c3] ord=0 default='MLPZ.phoneNumber' type='EXTERNAL_SYSTEM'
  - TEXT_FIELD `adres_e_mail` "Adres e-mail" [x0 y1 r1 c3] ord=1 default='MLPZ.email' type='EXTERNAL_SYSTEM'
- SECTION `zgoda_sekcja` "Zgoda_sekcja" [x0 y3 r2 c3 minItemRows=2] ord=3
  - CONSENT_SECTION `zgoda` "" [x0 y0 r1 c3] ord=0 consents={"consents": [{"description": "<html><head></head><body><p><span style=\"background-color: rgb(255, 255, 255); color: rgb(52, 56, 63);\">Wyrażam zgodę na przetwarzanie moich danych osobowych zgodnie z </span><a href=\"klauzulą informacyjną \" rel=\"noopener noreferrer\" target=\"_blank\" style=\"bac

## tab FINISH "Strona końcowa" id=a44aa5e3-3d2a-4e0e-adee-cb19a863756c

- SECTION `podglad_uzupelnionego_wniosku` "Podgląd uzupełnionego wniosku" [x0 y0 r2 c3] ord=0
  - TEXT_BLOCK `podglad_1` "" [x0 y0 r1 c3] ord=0 desc='<html><head></head><body><p><span style="background-color: rgb(255, 255, 255); color: rgb(31, 35, 40);">Zanim wyślesz wn'

flow: 7d4cff8e→455397a7 -> 455397a7→c7cbcee3 -> c7cbcee3→a44aa5e3 

# 05_nadplata_podatku: Wniosek o stwierdzenie nadpłaty podatku

## tab MAIN "Dane" id=59963a7f-b5e5-4eb4-83b2-571241924425

- SECTION `urzad_do_ktorego_jest_skladany_wniosek` "Urząd, do którego jest składany wniosek" [x0 y0 r2 c3] ord=0
  - TEXT_FIELD `nazwa_urzedu` "Nazwa urzędu" [x0 y0 r1 c3] ord=0 readOnly default='Urząd Gminy Ulan-Majorat' type=None
- SECTION `podmiot_wniosku` "Podmiot wniosku" [x0 y2 r3 c3] ord=2
  - RADIO `wybierz_w_czyim_imieniu_wnioskujesz` "Wybierz, w czyim imieniu wnioskujesz" [x0 y0 r1 c3] ord=0 opts=Swoim|Innej osoby|Osoby prawnej lub jednostki organizacyjnej
  - RADIO `wybierz_jako_kto_wnioskujesz` "Wybierz, jako kto wnioskujesz" [x0 y1 r1 c3] ord=1 opts=Pełnomocnik|Reprezentant
    - state SHOW: `("Osoby prawnej lub jednostki organizacyjnej" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_w_czyim_imieniu_wnioskujesz' in field.techName].field.__userAnswer)`
- SECTION `twoje_dane` "Twoje dane" [x0 y5 r4 c3] ord=5
  - TEXT_FIELD `imie` "Imię" [x0 y0 r1 c3] ord=0 readOnly default='PESEL.name' type='EXTERNAL_SYSTEM'
  - TEXT_FIELD `nazwisko` "Nazwisko" [x0 y1 r1 c3] ord=1 readOnly default='PESEL.surname' type='EXTERNAL_SYSTEM'
  - TEXT_FIELD `numer_pesel` "Numer PESEL" [x0 y2 r1 c3] ord=2 readOnly default='PESEL.pesel' type='EXTERNAL_SYSTEM'
- SECTION `adres_zamieszkania` "Adres zamieszkania" [x0 y9 r9 c3] ord=9
  - SELECT `kraj` "Kraj" [x0 y0 r1 c3] ord=0 dict=Kraje default=['Polska'] type=None searchEnabled=True multiLevelTree=False
  - TEXT_FIELD `miejscowosc_zagranica` "Miejscowość" [x0 y1 r1 c3] ord=1
    - state SHOW: `$not("Polska" in tabs['Dane' in title].questions['adres_zamieszkania' in field.techName].field.repeatingSectionGrid['kraj' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `kod_pocztowy_zagranica` "Kod pocztowy" [x0 y2 r1 c3] ord=2
    - state SHOW: `$not("Polska" in tabs['Dane' in title].questions['adres_zamieszkania' in field.techName].field.repeatingSectionGrid['kraj' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `ulica_zagranica` "Ulica" [x0 y3 r1 c3] ord=3
    - state SHOW: `$not("Polska" in tabs['Dane' in title].questions['adres_zamieszkania' in field.techName].field.repeatingSectionGrid['kraj' in field.techName].field.__userAnswer)`
  - SELECT `wojewodztwo` "TERYT_4G_DOWODOWY" [x0 y4 r1 c3] ord=4 dict=TERYT_4G_DOWODOWY searchEnabled=True multiLevelTree=True
    - state SHOW: `("Polska" in tabs['Dane' in title].questions['adres_zamieszkania' in field.techName].field.repeatingSectionGrid['kraj' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `kod_pocztowy` "Kod pocztowy" [x0 y5 r1 c3] ord=5 default='MLPZ.postCode' type='EXTERNAL_SYSTEM'
    - state SHOW: `("Polska" in tabs['Dane' in title].questions['adres_zamieszkania' in field.techName].field.repeatingSectionGrid['kraj' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `ulica` "Ulica" [x0 y6 r1 c3] ord=6 default='MLPZ.street' type='EXTERNAL_SYSTEM'
    - state SHOW: `("Polska" in tabs['Dane' in title].questions['adres_zamieszkania' in field.techName].field.repeatingSectionGrid['kraj' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `numer_budynku` "Numer budynku" [x0 y7 r1 c3] ord=7 default='MLPZ.building' type='EXTERNAL_SYSTEM'
  - TEXT_FIELD `numer_lokalu` "Numer lokalu" [x0 y8 r1 c3] ord=8 default='MLPZ.apartment' type='EXTERNAL_SYSTEM'
- SECTION `dane_podmiotu` "Dane podmiotu" [x0 y18 r3 c3] ord=18
  - state SHOW: `("Osoby prawnej lub jednostki organizacyjnej" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_w_czyim_imieniu_wnioskujesz' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `nazwa` "Nazwa" [x0 y0 r1 c3] ord=0
  - TEXT_FIELD `nip` "NIP" [x0 y1 r1 c3] ord=1
- SECTION `adres_siedziby` "Adres siedziby" [x0 y21 r8 c3] ord=21
  - state SHOW: `("Osoby prawnej lub jednostki organizacyjnej" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_w_czyim_imieniu_wnioskujesz' in field.techName].field.__userAnswer)`
  - SELECT `kraj_siedziba` "Kraj" [x0 y0 r1 c3] ord=0 dict=Kraje default=['Polska'] type=None searchEnabled=True multiLevelTree=False
  - TEXT_FIELD `miejscowosc_siedziba_zagranica` "Miejscowość" [x0 y1 r1 c3] ord=1
    - state SHOW: `$not("Polska" in tabs['Dane' in title].questions['adres_siedziby' in field.techName].field.repeatingSectionGrid['kraj_siedziba' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `kod_pocztowy_siedziba_zagranica` "Kod pocztowy" [x0 y2 r1 c3] ord=2
    - state SHOW: `$not("Polska" in tabs['Dane' in title].questions['adres_siedziby' in field.techName].field.repeatingSectionGrid['kraj_siedziba' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `ulica_siedziba_zagranica` "Ulica" [x0 y3 r1 c3] ord=3
    - state SHOW: `$not("Polska" in tabs['Dane' in title].questions['adres_siedziby' in field.techName].field.repeatingSectionGrid['kraj_siedziba' in field.techName].field.__userAnswer)`
  - SELECT `wojewodztwo_siedziba` "TERYT_4G_DOWODOWY" [x0 y4 r1 c3] ord=4 dict=TERYT_4G_DOWODOWY searchEnabled=True multiLevelTree=True
    - state SHOW: `("Polska" in tabs['Dane' in title].questions['adres_siedziby' in field.techName].field.repeatingSectionGrid['kraj_siedziba' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `kod_pocztowy_siedziba` "Kod pocztowy" [x0 y5 r1 c3] ord=5
    - state SHOW: `("Polska" in tabs['Dane' in title].questions['adres_siedziby' in field.techName].field.repeatingSectionGrid['kraj_siedziba' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `ulica_siedziba` "Ulica" [x0 y6 r1 c3] ord=6
    - state SHOW: `("Polska" in tabs['Dane' in title].questions['adres_siedziby' in field.techName].field.repeatingSectionGrid['kraj_siedziba' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `numer_budynku_siedziba` "Numer budynku" [x0 y7 r1 c3] ord=7
  - TEXT_FIELD `numer_lokalu_siedziba` "Numer lokalu" [x0 y8 r1 c3] ord=8
- SECTION `potwierdzenie_ze_jestes_reprezentantem` "Potwierdzenie, że jesteś reprezentantem" [x0 y29 r2 c3] ord=29 desc='<html><head></head><body><p><span style="background-color: rgb(255, 255, 255); color: rgb(31, 35, 40);">Dołącz aktualny '
  - state SHOW: `("Osoby prawnej lub jednostki organizacyjnej" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_w_czyim_imieniu_wnioskujesz' in field.techName].field.__userAnswer)
and
("Reprezentant" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_jako_kto_wnioskujesz' in field.techName].field.__userAnswer)`
  - FILE_UPLOADER `plik_z_odpisem_danych` "Plik z odpisem danych" [x0 y0 r1 c3] ord=0
- SECTION `dane_innej_osoby` "Dane innej osoby" [x0 y31 r3 c3] ord=31
  - state SHOW: `("Innej osoby" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_w_czyim_imieniu_wnioskujesz' in field.techName].field.__userAnswer)
`
  - TEXT_FIELD `imie_inna_osoba` "Imię" [x0 y0 r1 c3] ord=0
  - TEXT_FIELD `nazwisko_inna_osoba` "Nazwisko" [x0 y1 r1 c3] ord=1
- SECTION `adres_zamieszkania_osoby_ktorej_jestes_pelnomocnikiem` "Adres zamieszkania innej osoby" [x0 y34 r9 c3] ord=34
  - state SHOW: `("Innej osoby" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_w_czyim_imieniu_wnioskujesz' in field.techName].field.__userAnswer)
`
  - SELECT `kraj_inna_osoba` "Kraj" [x0 y0 r1 c3] ord=0 dict=Kraje default=['Polska'] type=None searchEnabled=True multiLevelTree=False
  - TEXT_FIELD `miejscowosc_inna_osoba_zagranica` "Miejscowość" [x0 y1 r1 c3] ord=1
    - state SHOW: `$not("Polska" in tabs['Dane' in title].questions['adres_zamieszkania_osoby_ktorej_jestes_pelnomocnikiem' in field.techName].field.repeatingSectionGrid['kraj_inna_osoba' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `kod_pocztowy_inna_osoba_zagranica` "Kod pocztowy" [x0 y2 r1 c3] ord=2
    - state SHOW: `$not("Polska" in tabs['Dane' in title].questions['adres_zamieszkania_osoby_ktorej_jestes_pelnomocnikiem' in field.techName].field.repeatingSectionGrid['kraj_inna_osoba' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `ulica_inna_osoba_zagranica` "Ulica" [x0 y3 r1 c3] ord=3
    - state SHOW: `$not("Polska" in tabs['Dane' in title].questions['adres_zamieszkania_osoby_ktorej_jestes_pelnomocnikiem' in field.techName].field.repeatingSectionGrid['kraj_inna_osoba' in field.techName].field.__userAnswer)`
  - SELECT `wojewodztwo_inna_osoba` "TERYT_DOWODOWY" [x0 y4 r1 c3] ord=4 dict=TERYT_DOWODOWY
    - state SHOW: `("Polska" in tabs['Dane' in title].questions['adres_zamieszkania_osoby_ktorej_jestes_pelnomocnikiem' in field.techName].field.repeatingSectionGrid['kraj_inna_osoba' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `kod_pocztowy_inna_osoba` "Kod pocztowy" [x0 y5 r1 c3] ord=5
    - state SHOW: `("Polska" in tabs['Dane' in title].questions['adres_zamieszkania_osoby_ktorej_jestes_pelnomocnikiem' in field.techName].field.repeatingSectionGrid['kraj_inna_osoba' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `ulica_inna_osoba` "Ulica" [x0 y6 r1 c3] ord=6
    - state SHOW: `("Polska" in tabs['Dane' in title].questions['adres_zamieszkania_osoby_ktorej_jestes_pelnomocnikiem' in field.techName].field.repeatingSectionGrid['kraj_inna_osoba' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `numer_budynku_inna_osoba` "Numer budynku" [x0 y7 r1 c3] ord=7
  - TEXT_FIELD `numer_lokalu_inna_osoba` "Numer lokalu" [x0 y8 r1 c3] ord=8
- SECTION `pelnomocnictwo` "Pełnomocnictwo" [x0 y43 r2 c3] ord=43 desc='<html><head></head><body><p><span style="background-color: rgb(255, 255, 255); color: rgb(31, 35, 40);">Dodaj dokument p'
  - state SHOW: `("Innej osoby" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_w_czyim_imieniu_wnioskujesz' in field.techName].field.__userAnswer)

or 

(

("Osoby prawnej lub jednostki organizacyjnej" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_w_czyim_imieniu_wnioskujesz' in field.techName].field.__userAnswer)

and 

("Pełnomocnik" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_jako_kto_wnioskujesz' in field.techName].field.__userAnswer)


)`
  - FILE_UPLOADER `plik_dokumentu_z_pelnomocnictwem` "Plik dokumentu z pełnomocnictwem" [x0 y0 r1 c3] ord=0
- SECTION `oplata_skarbowa_pelnomocnictwo_1` "Opłata skarbowa" [x0 y45 r4 c3] ord=45 desc='<html><head></head><body><p><span style="background-color: rgb(255, 255, 255); color: rgb(31, 35, 40);">Nie musisz płaci'
  - state SHOW: `("Innej osoby" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_w_czyim_imieniu_wnioskujesz' in field.techName].field.__userAnswer)
`
  - RADIO `czy_zlozenie_pelnomocnictwa_wymaga_oplaty_skarbowej` "Czy złożenie pełnomocnictwa wymaga opłaty skarbowej?" [x0 y0 r1 c3] ord=0 opts=Tak|Nie
  - TEXT_BLOCK `oplata_info_1` "" [x0 y1 r1 c3] ord=1 desc='<html><head></head><body><p>Opłata skarbowa za pełnomocnictwo wynosi\xa0<strong>17 zł</strong>.</p><p>Przelej ją na konto u'
    - state SHOW: `("Tak" in tabs['Dane' in title].questions['oplata_skarbowa_pelnomocnictwo_1' in field.techName].field.repeatingSectionGrid['czy_zlozenie_pelnomocnictwa_wymaga_oplaty_skarbowej' in field.techName].field.__userAnswer)`
  - FILE_UPLOADER `plik_z_potwierdzeniem_przelewu` "Plik z potwierdzeniem przelewu" [x0 y2 r1 c3] ord=2
    - state SHOW: `("Tak" in tabs['Dane' in title].questions['oplata_skarbowa_pelnomocnictwo_1' in field.techName].field.repeatingSectionGrid['czy_zlozenie_pelnomocnictwa_wymaga_oplaty_skarbowej' in field.techName].field.__userAnswer)`
- SECTION `oplata_skarbowa_pelnomocnictwo_2` "Opłata skarbowa za pełnomonictwo" [x0 y49 r3 c3] ord=49
  - state SHOW: `("Osoby prawnej lub jednostki organizacyjnej" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_w_czyim_imieniu_wnioskujesz' in field.techName].field.__userAnswer)

and 

("Pełnomocnik" in tabs['Dane' in title].questions['podmiot_wniosku' in field.techName].field.repeatingSectionGrid['wybierz_jako_kto_wnioskujesz' in field.techName].field.__userAnswer)`
  - TEXT_BLOCK `oplata_info` "" [x0 y0 r1 c3] ord=0 desc='<html><head></head><body><p>Opłata skarbowa za pełnomocnictwo wynosi\xa0<strong>17 zł</strong>.</p><p>Przelej ją na konto u'
  - FILE_UPLOADER `plik_z_potwierdzeniem_przelewu_2` "Plik z potwierdzeniem przelewu" [x0 y1 r1 c3] ord=1

## tab MAIN "Informacje o nadpłacie" id=6dca1c32-9991-47a7-b563-b6f0237e0970

- SECTION `informacje_o_nadplacie` "Informacje o nadpłacie" [x0 y0 r4 c3] ord=0
  - TEXT_FIELD `podatek_ktorego_dotyczy_nadplata` "Podatek, którego dotyczy nadpłata" [x0 y0 r1 c3] ord=0
  - NUMBER `kwota` "Kwota" [x0 y1 r1 c3] ord=1
  - TEXTAREA `uzasadnienie` "Uzasadnienie" [x0 y2 r1 c3] ord=2 desc='<html><head></head><body><p>Uzasadnij dlaczego Twoim zdaniem powstała nadpłata i z czego wynika jej wysokość.</p></body>'
- SECTION `rozliczenie_nadplaty` "Rozliczenie nadpłaty" [x0 y4 r4 c3] ord=4
  - RADIO `wybierz_co_mamy_zrobic_z_nadplata` "Wybierz, co mamy zrobić z nadpłatą" [x0 y0 r1 c3] ord=0 opts=Zaliczyć na poczet przyszłego zobowiązania podatkowego|Zwrócić przelewem na rachunek bankowy
  - TEXT_FIELD `nazwa_podatku` "Nazwa podatku" [x0 y1 r1 c3] ord=1
    - state SHOW: `("Zaliczyć na poczet przyszłego zobowiązania podatkowego" in tabs['Informacje o nadpłacie' in title].questions['rozliczenie_nadplaty' in field.techName].field.repeatingSectionGrid['wybierz_co_mamy_zrobic_z_nadplata' in field.techName].field.__userAnswer)`
  - TEXT_FIELD `numer_rachunku` "Numer rachunku" [x0 y2 r1 c3] ord=2
    - state SHOW: `("Zwrócić przelewem na rachunek bankowy" in tabs['Informacje o nadpłacie' in title].questions['rozliczenie_nadplaty' in field.techName].field.repeatingSectionGrid['wybierz_co_mamy_zrobic_z_nadplata' in field.techName].field.__userAnswer)`
- SECTION `korekta_deklaracji` "Korekta deklaracji" [x0 y8 r2 c3] ord=8 desc='<html><head></head><body><p>Załącz poprawioną deklarację podatkową, z której wynika prawidłowa, niższa wysokość zobowiąz'
  - FILE_UPLOADER `plik_deklaracji_podatkowej` "Plik deklaracji podatkowej" [x0 y0 r1 c3] ord=0

## tab MAIN "Kontakt i zgody" id=779573a6-1436-441f-a2a7-0cee229b30d2

- SECTION `dane_do_kontaktu` "Dane do kontaktu" [x0 y0 r3 c3] ord=0 desc='<html><head></head><body><p><span style="background-color: rgba(0, 0, 0, 0); color: rgb(57, 57, 57);">Wpisanie danych do'
  - TEXT_FIELD `numer_telefonu` "Numer telefonu" [x0 y0 r1 c3] ord=0 default='MLPZ.phoneNumber' type='EXTERNAL_SYSTEM'
  - TEXT_FIELD `adres_e_mail` "Adres e-mail" [x0 y1 r1 c3] ord=1 default='MLPZ.email' type='EXTERNAL_SYSTEM'
- SECTION `zgoda_wyrazenie` "Zgoda" [x0 y3 r2 c3] ord=3
  - CONSENT_SECTION `zgoda` "" [x0 y0 r1 c3] ord=0 consents={"consents": [{"description": "<html><head></head><body><p><span style=\"background-color: rgb(255, 255, 255); color: rgb(52, 56, 63);\">Wyrażam zgodę na przetwarzanie moich danych osobowych zgodnie z </span><a href=\"klauzulą informacyjną \" rel=\"noopener noreferrer\" target=\"_blank\" style=\"bac

## tab FINISH "Strona końcowa" id=db916c6e-9595-4251-80d3-bfea63690bd6

- SECTION `podglad_uzupelnionego_wniosku` "Podgląd uzupełnionego wniosku" [x0 y0 r2 c3] ord=0
  - TEXT_BLOCK `podglad_1` "" [x0 y0 r1 c3] ord=0 desc='<html><head></head><body><p><span style="color: rgb(31, 35, 40); background-color: rgb(255, 255, 255);">Zanim przejdzies'

flow: 59963a7f→6dca1c32 -> 6dca1c32→779573a6 -> 779573a6→db916c6e 

