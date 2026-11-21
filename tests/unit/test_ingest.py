import pytest

from formgen.ingest import load
from formgen.ingest.detect import detect_kind
from tests.conftest import ROOT

REF = ROOT / "data" / "input" / "01_przyklady_formularze" / "05_nadplata_podatku"
EVAL = ROOT / "data" / "input" / "04_formularze_do_oceny"
TEXT_FORMATS = ["PDF", "docx", "ODS"]


@pytest.mark.parametrize("ext", TEXT_FORMATS)
def test_text_formats_of_same_form_agree(ext):
    path = next(p for p in REF.glob(f"*.{ext}") if "wizualizacja" not in p.name)
    kind, _ = detect_kind(path.read_bytes())
    doc = load(path.read_bytes(), kind)
    text = doc.to_prompt_text()
    for needle in (
        "Wnioskodawca",
        "nadpłaty",
        "Uzasadnienie",
        "zaliczyć na poczet",
        "zwrócić przelewem",
        "korekta deklaracji",
    ):
        assert needle in text, (ext, needle)


def test_pdf_checkboxes_and_fills_form08():
    path = EVAL / "08_deklaracja_odpady" / "Deklaracja o wysokości opłaty.pdf"
    doc = load(path.read_bytes(), "pdf")
    text = doc.to_prompt_text([1])
    assert text.count("☐") >= 6
    assert "właściciel/współwłaściciel" in text
    assert "## B.1 DANE IDENTYFIKACYJNE" in text
    assert len(doc.pages) == 6


def test_pdf_converted_docx_with_textboxes_form08():
    path = EVAL / "08_deklaracja_odpady" / "Deklaracja o wysokości opłaty.docx"
    doc = load(path.read_bytes(), "docx")
    assert len(doc.pages) == 6
    assert "B.1 DANE IDENTYFIKACYJNE" in doc.to_prompt_text([1])


def test_docx_16_pages_form09_glyph_checkboxes():
    path = EVAL / "09_stypendium_sportowe" / "Wniosek o przyznanie stypendium.docx"
    doc = load(path.read_bytes(), "docx")
    text = doc.to_prompt_text()
    assert text.count("☐") >= 10
    assert "Dane reprezentanta klubu sportowego" in text


def test_image_ocr_form05():
    path = next(REF.glob("*.PNG"))
    doc = load(path.read_bytes(), "png")
    assert doc.ocr and "nadpłaty podatku" in doc.to_prompt_text()


def test_tall_png_is_split_into_pages():
    path = EVAL / "08_deklaracja_odpady" / "Deklaracja o wysokości opłaty.png"
    from PIL import Image

    from formgen.ingest.image import split_pages

    assert len(split_pages(Image.open(path))) == 6
