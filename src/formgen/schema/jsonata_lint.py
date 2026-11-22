"""Static lint of JSONata ``states[].query`` strings against the form structure.

Checks:
1. syntax: the query must parse with ``jsonata-python`` (Apache-2.0).
2. cycles (``state_cycles``): an element whose visibility depends, directly or
   through other conditions, on itself can never be shown.
3. references: every ``tabs['T' in title].questions['s' in field.techName]
   .field.repeatingSectionGrid['f' in field.techName]`` path must point at an
   existing tab / section / field, and a quoted literal compared with ``in``
   must be one of that field's option names (when the field has options).
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

import jsonata

from formgen.schema.model import FormDefinition

# a JSONata string literal in either quote style, backslash escapes included
_STR = r"""(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")"""
_TAB = rf"tabs\[(?P<tab>{_STR}) in title\]"
_SEC = rf"\.questions\[(?P<sec>{_STR}) in field\.techName\]"
_FLD = rf"\.field\.repeatingSectionGrid\[(?P<fld>{_STR}) in field\.techName\]"
_REF_RE = re.compile(_TAB + r"(?:" + _SEC + r")?(?:" + _FLD + r")?")
_LITERAL_BEFORE_RE = re.compile(rf"(?P<lit>{_STR})\s+in\s+$")


def _unquote(token: str | None) -> str | None:
    """Value of a JSONata string literal in either quote style (JSON escapes, plus ``\\'``)."""
    if token is None:
        return None

    def esc(m: re.Match) -> str:
        if m.group(0) == '"':
            return '\\"'
        return "'" if m.group(1) == "'" else m.group(0)

    body = re.sub(r"\\(.)|\"", esc, token[1:-1])
    try:
        return json.loads(f'"{body}"')
    except ValueError:
        return token[1:-1]


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
        tab, sec, fld = (_unquote(m.group(g)) for g in ("tab", "sec", "fld"))
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
            value = _unquote(lit.group("lit")) if lit else None
            if value is not None and value not in options:
                issues.append(
                    LintIssue(
                        "JSONATA_LITERAL",
                        f"'{value}' is not an option of '{fld}' ({sorted(options)})",
                    )
                )
    return issues


Node = tuple[str, str, str]  # (tab title, section techName, field techName or "" for the section itself)


def state_cycles(form: FormDefinition) -> list[list[Node]]:
    """Cycles in the 'visible only if' graph: element -> referenced field, field -> its section."""
    deps: dict[Node, set[Node]] = {}
    for tab in form.tabs:
        for q in tab.questions:
            sec = q.field
            sec_node = (tab.title, sec.techName, "")
            deps.setdefault(sec_node, set()).update(_state_refs(sec))
            for f in sec.iter_fields():
                if f is not sec:
                    deps.setdefault((tab.title, sec.techName, f.techName), set()).update({sec_node, *_state_refs(f)})
    cycles: list[list[Node]] = []
    state: dict[Node, int] = {}  # 1 = on the DFS stack, 2 = done
    stack: list[Node] = []

    def visit(n: Node) -> None:
        state[n] = 1
        stack.append(n)
        for m in deps.get(n, ()):
            if state.get(m) == 1:
                cycles.append(stack[stack.index(m) :])
            elif m not in state:
                visit(m)
        stack.pop()
        state[n] = 2

    for n in deps:
        if n not in state:
            visit(n)
    return cycles


def _state_refs(f) -> set[Node]:
    return {
        (_unquote(m.group("tab")), _unquote(m.group("sec")), _unquote(m.group("fld")) or "")
        for s in f.states
        for m in _REF_RE.finditer(s.query)
        if m.group("sec")
    }
