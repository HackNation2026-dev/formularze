"""Static lint of JSONata ``states[].query`` strings against the form structure.

Two checks:
1. syntax: the query must parse with ``jsonata-python`` (Apache-2.0).
2. references: every ``tabs['T' in title].questions['s' in field.techName]
   .field.repeatingSectionGrid['f' in field.techName]`` path must point at an
   existing tab / section / field, and a quoted literal compared with ``in``
   must be one of that field's option names (when the field has options).
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import jsonata

from formgen.schema.model import FormDefinition

_TAB = r"tabs\['(?P<tab>[^']*)' in title\]"
_SEC = r"\.questions\['(?P<sec>[^']*)' in field\.techName\]"
_FLD = r"\.field\.repeatingSectionGrid\['(?P<fld>[^']*)' in field\.techName\]"
_REF_RE = re.compile(_TAB + r"(?:" + _SEC + r")?(?:" + _FLD + r")?")
_LITERAL_BEFORE_RE = re.compile(r'"(?P<lit>[^"]*)"\s+in\s+$')


@dataclass(frozen=True)
class LintIssue:
    code: str
    message: str


def parse_ok(query: str) -> str | None:
    """Return None when the query parses, else the parser error message."""
    try:
        jsonata.Jsonata(query)
    except Exception as exc:
        return str(exc)
    return None


def _index(form: FormDefinition) -> dict[str, dict[str, dict[str, set[str]]]]:
    """tab title -> section techName -> field techName -> option names."""
    idx: dict[str, dict[str, dict[str, set[str]]]] = {}
    for tab in form.tabs:
        sections = idx.setdefault(tab.title, {})
        for q in tab.questions:
            sec = q.field
            fields = sections.setdefault(sec.techName, {})
            for f in sec.iter_fields():
                fields[f.techName] = {o.name for o in f.options}
    return idx


def lint_query(query: str, form: FormDefinition) -> list[LintIssue]:
    issues: list[LintIssue] = []
    err = parse_ok(query)
    if err:
        issues.append(LintIssue("JSONATA_SYNTAX", err))
        return issues
    idx = _index(form)
    for m in _REF_RE.finditer(query):
        tab, sec, fld = m.group("tab"), m.group("sec"), m.group("fld")
        if tab not in idx:
            issues.append(LintIssue("JSONATA_REF_TAB", f"tab '{tab}' not found"))
            continue
        if sec is None:
            continue
        if sec not in idx[tab]:
            issues.append(LintIssue("JSONATA_REF_SECTION", f"section '{sec}' not in tab '{tab}'"))
            continue
        if fld is None:
            continue
        if fld not in idx[tab][sec]:
            issues.append(LintIssue("JSONATA_REF_FIELD", f"field '{fld}' not in section '{sec}' of tab '{tab}'"))
            continue
        options = idx[tab][sec][fld]
        if options:
            # literal immediately before this reference: ``"X" in tabs[...]``
            lit = _LITERAL_BEFORE_RE.search(query[: m.start()])
            if lit and lit.group("lit") not in options:
                issues.append(
                    LintIssue(
                        "JSONATA_LITERAL",
                        f"'{lit.group('lit')}' is not an option of '{fld}' ({sorted(options)})",
                    )
                )
    return issues
