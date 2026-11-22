"""Technical rules for a FormDefinition (from 'Reguły techniczne konfiguracji formularzy').

``check_rules`` never raises; it returns a list of violations. ``error`` means the
file would be rejected or is inconsistent; ``warning`` means a best-practice gap.
Golden files from COI pass with zero errors (see tests/unit/test_golden.py).
"""

from __future__ import annotations

import itertools
from dataclasses import dataclass
from enum import StrEnum

from formgen.compose.dictionaries import SELECT_ONLY
from formgen.schema.jsonata_lint import lint_query, state_cycles
from formgen.schema.model import (
    CONTAINER_TYPES,
    DICTIONARY_TYPES,
    INPUT_TYPES,
    FieldType,
    FormDefinition,
    Question,
    TabType,
    Validator,
)

MAX_TITLE = 255


class Severity(StrEnum):
    ERROR = "error"
    WARNING = "warning"


@dataclass(frozen=True)
class Violation:
    code: str
    severity: Severity
    message: str
    path: str = ""

    def __str__(self) -> str:
        return f"[{self.severity}] {self.code} {self.path}: {self.message}"


def check_rules(form: FormDefinition) -> list[Violation]:
    v: list[Violation] = []

    def err(code, msg, path=""):
        return v.append(Violation(code, Severity.ERROR, msg, path))

    def warn(code, msg, path=""):
        return v.append(Violation(code, Severity.WARNING, msg, path))

    # R-T1 title
    if not form.title.strip():
        err("TITLE_EMPTY", "form title is empty")
    if len(form.title) > MAX_TITLE:
        err("TITLE_TOO_LONG", f"title has {len(form.title)} chars, max {MAX_TITLE}")

    # R-T2 tabs: >= 2, last FINISH, others MAIN
    tabs = form.tabs
    if len(tabs) < 2:
        err("TABS_MIN_TWO", f"form has {len(tabs)} tabs, needs at least 2")
    for i, tab in enumerate(tabs):
        path = f"tabs[{i}]"
        is_last = i == len(tabs) - 1
        if is_last and tab.type != TabType.FINISH:
            err("LAST_TAB_NOT_FINISH", f"last tab '{tab.title}' is {tab.type}, must be FINISH", path)
        if not is_last and tab.type != TabType.MAIN:
            err("TAB_NOT_MAIN", f"tab '{tab.title}' is {tab.type}, must be MAIN", path)
        # R-T3 each tab >= 1 question
        if not tab.questions:
            err("TAB_EMPTY", f"tab '{tab.title}' has no questions", path)
        # R-T4 top-level questions must be containers; no nesting of containers
        for j, q in enumerate(tab.questions):
            qpath = f"{path}.questions[{j}]"
            f = q.field
            if f.type not in CONTAINER_TYPES:
                err("FIELD_NOT_IN_SECTION", f"'{f.techName}' ({f.type}) is not inside a section", qpath)
            for inner in f.repeatingSectionGrid:
                if inner.field.type in CONTAINER_TYPES:
                    err(
                        "NESTED_SECTION",
                        f"section '{inner.field.techName}' nested in '{f.techName}'",
                        qpath,
                    )
            # R-T5 FINISH tab: no input fields
            if tab.type == TabType.FINISH:
                for inner in f.iter_fields():
                    if inner.type in INPUT_TYPES:
                        err("INPUT_ON_FINISH", f"input field '{inner.techName}' on FINISH tab", qpath)
            _check_grid(q, qpath, err, warn)

    for cycle in state_cycles(form):
        names = " -> ".join(fld or sec for _, sec, fld in [*cycle, cycle[0]])
        err("STATE_CYCLE", f"visibility depends on itself, never shown: {names}", f"tabs['{cycle[0][0]}']")

    # R-T7 flow: links chain tabs in order
    ids = [t.id for t in tabs]
    pairs = {(ln.source, ln.target) for ln in form.flow.links}
    for a, b in itertools.pairwise(ids):
        if (a, b) not in pairs:
            err("FLOW_MISSING_LINK", f"no flow link from tab '{a[:8]}' to '{b[:8]}'", "flow")
    for ln in form.flow.links:
        if ln.source not in ids or ln.target not in ids:
            err("FLOW_UNKNOWN_TAB", f"link {ln.id[:8]} references unknown tab", "flow")

    # per-field checks
    seen: dict[str, str] = {}
    for tab, f in form.iter_fields():
        path = f"{tab.title}/{f.techName}"
        if not f.techName:
            err("TECHNAME_EMPTY", f"field of type {f.type} has empty techName", path)
        if f.techName in seen:
            err("TECHNAME_DUPLICATE", f"techName '{f.techName}' also in {seen[f.techName]}", path)
        seen[f.techName] = path
        # R-T9 dictionaries only on SELECT/RADIO/CHECKBOX
        if f.dictionaryName and f.type not in DICTIONARY_TYPES:
            err("DICTIONARY_ON_WRONG_TYPE", f"dictionary on {f.type}", path)
        if f.dictionaryName in SELECT_ONLY and f.type != FieldType.SELECT:
            err("DICTIONARY_SELECT_ONLY", f"dictionary '{f.dictionaryName}' allowed only on SELECT, got {f.type}", path)
        # R-T10 initial data => EXTERNAL_SYSTEM must have a source.attr default
        if f.defaultValueType == "EXTERNAL_SYSTEM":
            dv = f.defaultValue if isinstance(f.defaultValue, str) else ""
            if "." not in dv:
                err("EXTERNAL_DEFAULT_FORMAT", f"defaultValue '{dv}' is not SOURCE.attribute", path)
        if f.type == FieldType.CONSENT_SECTION and (
            f.consentSectionConfig is None or not f.consentSectionConfig.consents
        ):
            err("CONSENT_EMPTY", "CONSENT_SECTION without consents", path)
        if f.type in {FieldType.INFO_SECTION} and not f.description:
            err("INFO_SECTION_NO_DESCRIPTION", "INFO_SECTION requires description", path)
        if f.type in {FieldType.RADIO, FieldType.SELECT, FieldType.CHECKBOX} and not f.options and not f.dictionaryName:
            warn("NO_OPTIONS", f"{f.type} has neither options nor dictionary", path)
        # R-T6 obligatoriness: REQUIRED present or explicitly optional (empty list); names must be known
        if f.type in INPUT_TYPES and any(x not in set(Validator) for x in f.validation):
            err("UNKNOWN_VALIDATOR", f"unknown validators {f.validation}", path)
        # R-T8 states: lint JSONata
        for s in f.states:
            for issue in lint_query(s.query, form):
                err(issue.code, issue.message, path)
    return v


def _check_grid(q: Question, path: str, err, warn) -> None:
    f = q.field
    if q.rows < 1 or q.cols < 1 or q.x < 0 or q.y < 0:
        err("GRID_INVALID", f"x={q.x} y={q.y} rows={q.rows} cols={q.cols}", path)
    if f.type in CONTAINER_TYPES:
        inner = f.repeatingSectionGrid
        ys = sorted(c.y for c in inner)
        if ys and ys != list(range(len(ys))):
            warn("GRID_INNER_Y", f"inner y positions {ys} are not 0..n-1", path)
        for c in inner:
            if c.field.questionOrder != c.y:
                warn("ORDER_MISMATCH", f"'{c.field.techName}' questionOrder != y", path)


def errors_only(violations: list[Violation]) -> list[Violation]:
    return [x for x in violations if x.severity == Severity.ERROR]
