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


FORM08_PDF = EVAL / "08_deklaracja_odpady" / "Deklaracja o wysokości opłaty.pdf"


def _mixed_pdf(src: bytes) -> bytes:
    """Page 1 keeps its text layer, page 2 becomes an image-only scan of the original page 2."""
    import io

    import pypdfium2 as pdfium
    from pypdf import PdfReader, PdfWriter

    scan = io.BytesIO()
    pdfium.PdfDocument(src)[1].render(scale=200 / 72).to_pil().save(scan, format="PDF", resolution=200)
    out = PdfWriter()
    out.add_page(PdfReader(io.BytesIO(src)).pages[0])
    out.add_page(PdfReader(scan).pages[0])
    buf = io.BytesIO()
    out.write(buf)
    return buf.getvalue()


def test_pdf_with_scanned_page_after_text_page_is_ocred():
    doc = load(_mixed_pdf(FORM08_PDF.read_bytes()), "pdf")
    assert len(doc.pages) == 2
    assert "B.1 DANE IDENTYFIKACYJNE" in doc.to_prompt_text([1])
    assert "ADRES DO KORESPONDENCJI" in doc.to_prompt_text([2])
    assert doc.ocr


def test_text_pdf_is_not_ocred():
    assert not load(FORM08_PDF.read_bytes(), "pdf").ocr


def _dark_rows(im) -> list[int]:
    from PIL import Image

    g = im.convert("L")
    col = g.resize((1, g.height), Image.BOX)
    return [y for y in range(g.height) if col.getpixel((0, y)) < 250]


def test_split_pages_cuts_in_whitespace_not_through_text():
    from PIL import Image, ImageDraw

    from formgen.ingest.image import split_pages

    w = 1000
    h = int(2 * w * 1.4142)
    im = Image.new("L", (w, h), 255)
    d = ImageDraw.Draw(im)
    rows = range((h // 2 - 10) % 60, h - 40, 60)  # text rows 30 px high, 30 px gaps, one straddles the cut at h/2
    for top in rows:
        d.rectangle((50, top, 950, top + 30), fill=0)
    assert any(top <= h // 2 <= top + 30 for top in rows), "fixture must put text on the naive cut"
    pages = split_pages(im)
    assert len(pages) == 2
    assert sum(p.height for p in pages) == h
    for p in pages:
        dark = _dark_rows(p)
        assert 0 not in dark and p.height - 1 not in dark, "a text row was cut in half"


def test_tall_png_cuts_land_on_blank_rows():
    from PIL import Image

    from formgen.ingest.image import split_pages

    pages = split_pages(Image.open(EVAL / "08_deklaracja_odpady" / "Deklaracja o wysokości opłaty.png"))
    for p in pages[1:]:
        assert 0 not in _dark_rows(p)
