"""techName slugs in the style of the golden files: ``Wybierz, w czyim imieniu`` -> ``wybierz_w_czyim_imieniu``."""

import re

_PL = str.maketrans("ąćęłńóśźżĄĆĘŁŃÓŚŹŻ", "acelnoszzACELNOSZZ")
_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def slug(text: str, max_len: int = 60) -> str:
    s = text.translate(_PL).lower()
    s = _NON_ALNUM.sub("_", s).strip("_")
    return s[:max_len].rstrip("_") or "pole"


def unique(base: str, taken: set[str]) -> str:
    """Return ``base`` or ``base_2``, ``base_3`` ... not yet in ``taken``; registers it."""
    name, n = base, 1
    while name in taken:
        n += 1
        name = f"{base}_{n}"
    taken.add(name)
    return name
