"""Structure-aware comparison of a generated FormDefinition against a golden one.

Leaf fields are matched per tab by techName (exact) or title (rapidfuzz
token_set_ratio >= 80). Reports precision/recall/F1 of fields, type accuracy on
matched fields, section-title accuracy, SHOW-state recall and a composite score.
The same report is computed separately for template tabs (Dane, Kontakt, Strona
końcowa: built from fixed templates, so they score high almost for free) and for
subject-of-application tabs (what the extractor actually has to find).
``show_logic`` goes past presence: for each golden field with a SHOW condition it
evaluates both JSONata conditions on the same answer vectors and requires equal results.
"""

from __future__ import annotations

import itertools
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any

import jsonata
from rapidfuzz import fuzz

from formgen.schema.jsonata_lint import _LITERAL_BEFORE_RE, _REF_RE, _unquote
from formgen.schema.model import CONTAINER_TYPES, FormDefinition, StateType

FUZZ_MIN = 80
TEMPLATE_TABS = ("Dane", "Kontakt i zgody", "Kontakt z urzędem", "Strona końcowa")


def _tab_key(title: str) -> str:
    """Template tabs must match by name; subject-of-application tabs are pooled (their titles are free text)."""
    if title in ("Kontakt i zgody", "Kontakt z urzędem"):
        return "Kontakt"
    return title if title in TEMPLATE_TABS else "*"


@dataclass
class Leaf:
    tab: str
    section: str
    tech: str
    title: str
    type: str
    has_show: bool
    key: tuple[str, str, str] = ("", "", "")  # (tab title, section techName, field techName) as JSONata sees it
    options: tuple[str, ...] = ()
    shows: tuple[str, ...] = ()  # SHOW queries of the field and of its section: all must hold


@dataclass
class Report:
    tp: int = 0
    fp: int = 0
    fn: int = 0
    type_ok: int = 0
    section_ok: int = 0
    show_tp: int = 0
    show_total: int = 0
    show_logic_ok: int = 0
    unmatched_golden: list[str] = field(default_factory=list)
    unmatched_ours: list[str] = field(default_factory=list)
    subject: Report | None = None
    template: Report | None = None
    matches: list[tuple[Leaf, Leaf]] = field(default_factory=list, repr=False)  # (golden, ours)

    @property
    def precision(self) -> float:
        return self.tp / (self.tp + self.fp) if self.tp + self.fp else 0.0

    @property
    def recall(self) -> float:
        return self.tp / (self.tp + self.fn) if self.tp + self.fn else 0.0

    @property
    def f1(self) -> float:
        p, r = self.precision, self.recall
        return 2 * p * r / (p + r) if p + r else 0.0

    @property
    def f1_subject(self) -> float:
        return self.subject.f1 if self.subject else 0.0

    @property
    def f1_template(self) -> float:
        return self.template.f1 if self.template else 0.0

    @property
    def type_acc(self) -> float:
        return self.type_ok / self.tp if self.tp else 0.0

    @property
    def section_acc(self) -> float:
        return self.section_ok / self.tp if self.tp else 0.0

    @property
    def show_recall(self) -> float:
        return self.show_tp / self.show_total if self.show_total else 1.0

    @property
    def show_logic(self) -> float:
        return self.show_logic_ok / self.show_total if self.show_total else 1.0

    def composite(self, validator_pass: bool = True) -> float:
        return (
            0.5 * self.f1
            + 0.15 * self.type_acc
            + 0.1 * self.section_acc
            + 0.1 * self.show_recall
            + 0.15 * float(validator_pass)
        )

    def summary(self) -> str:
        return (
            f"P={self.precision:.2f} R={self.recall:.2f} F1={self.f1:.2f} type={self.type_acc:.2f} "
            f"section={self.section_acc:.2f} show={self.show_recall:.2f} logic={self.show_logic:.2f} composite={self.composite():.2f} "
            f"F1_subject={self.f1_subject:.2f} F1_template={self.f1_template:.2f}"
        )


def leaves(form: FormDefinition, tabs: set[str] | None = None) -> list[Leaf]:
    out: list[Leaf] = []
    for tab in form.tabs:
        if tabs and tab.title not in tabs:
            continue
        for q in tab.questions:
            sec = q.field
            sec_shows = tuple(s.query for s in sec.states if s.type == StateType.SHOW)
            for f in sec.iter_fields():
                if f.type in CONTAINER_TYPES:
                    continue
                out.append(
                    Leaf(
                        tab.title,
                        sec.title,
                        f.techName,
                        f.title,
                        str(f.type),
                        bool(f.states) or bool(sec.states),
                        (tab.title, sec.techName, f.techName),
                        tuple(o.name for o in f.options),
                        tuple(s.query for s in f.states if s.type == StateType.SHOW) + sec_shows,
                    )
                )
    return out


def _match(a: Leaf, b: Leaf) -> bool:
    if a.tech == b.tech:
        return True
    return bool(a.title and b.title and fuzz.token_set_ratio(a.title, b.title) >= FUZZ_MIN)


def compare(ours: FormDefinition, golden: FormDefinition, tabs: set[str] | None = None) -> Report:
    g_leaves, o_leaves = leaves(golden, tabs), leaves(ours, tabs)
    r = _compare(g_leaves, o_leaves)
    # leaves only ever match within one tab key, so the two parts add up to the overall counts
    for part, is_template in (("subject", False), ("template", True)):
        g_part = [lf for lf in g_leaves if (_tab_key(lf.tab) != "*") == is_template]
        o_part = [lf for lf in o_leaves if (_tab_key(lf.tab) != "*") == is_template]
        sub = _compare(g_part, o_part)
        sub.show_logic_ok = _logic_ok(sub.matches, g_leaves)
        setattr(r, part, sub)
    r.show_logic_ok = r.subject.show_logic_ok + r.template.show_logic_ok
    return r


def _compare(g_leaves: list[Leaf], o_leaves: list[Leaf]) -> Report:
    r = Report()
    # exact techName first, so a fuzzy title ("Kod pocztowy") cannot grab a sibling's twin ("kod_pocztowy_zagranica")
    exact: dict[int, int] = {}
    for gi, g in enumerate(g_leaves):
        for i, o in enumerate(o_leaves):
            if i not in exact.values() and o.tech == g.tech and _tab_key(o.tab) == _tab_key(g.tab):
                exact[gi] = i
                if o.section == g.section:
                    break
    used: set[int] = set(exact.values())
    for gi, g in enumerate(g_leaves):
        best = exact.get(gi)
        for i, o in enumerate(o_leaves) if best is None else ():
            if i in used or _tab_key(o.tab) != _tab_key(g.tab):
                continue
            if _match(g, o) and (best is None or o.section == g.section):
                best = i
                if o.section == g.section:
                    break
        if best is None:
            r.fn += 1
            r.unmatched_golden.append(f"{g.tab}/{g.section}/{g.tech}")
            if g.has_show:
                r.show_total += 1
            continue
        used.add(best)
        o = o_leaves[best]
        r.matches.append((g, o))
        r.tp += 1
        r.type_ok += o.type == g.type
        r.section_ok += fuzz.token_set_ratio(o.section, g.section) >= FUZZ_MIN
        if g.has_show:
            r.show_total += 1
            r.show_tp += o.has_show
    for i, o in enumerate(o_leaves):
        if i not in used:
            r.fp += 1
            r.unmatched_ours.append(f"{o.tab}/{o.section}/{o.tech}")
    return r


# ---------- condition logic -----------------------------------------------------------------------

MAX_VECTORS = 32
OTHER = "\u0000inna wartość"  # an answer equal to none of the options / literals


@lru_cache(maxsize=4096)
def _compiled(query: str) -> jsonata.Jsonata:
    return jsonata.Jsonata(query)


def _refs(queries: tuple[str, ...]) -> dict[tuple[str, str, str], set[str]]:
    """Field references in the queries -> literals compared against them."""
    out: dict[tuple[str, str, str], set[str]] = {}
    for q in queries:
        for m in _REF_RE.finditer(q):
            if not m.group("fld"):
                continue
            lits = out.setdefault(tuple(_unquote(m.group(g)) for g in ("tab", "sec", "fld")), set())
            if lit := _LITERAL_BEFORE_RE.search(q[: m.start()]):
                lits.add(_unquote(lit.group("lit")))
    return out


def _visible(queries: tuple[str, ...], answers: dict[tuple[str, str, str], str]) -> bool:
    """Evaluate on a document holding only the referenced fields: same result, a fraction of the cost."""
    doc: dict[str, Any] = {"tabs": []}
    tabs: dict[str, dict] = {}
    secs: dict[tuple[str, str], dict] = {}
    for key in {**dict.fromkeys(_refs(queries), ""), **answers}:
        tab, sec, fld = key
        if tab not in tabs:
            tabs[tab] = {"title": tab, "questions": []}
            doc["tabs"].append(tabs[tab])
        if (tab, sec) not in secs:
            secs[tab, sec] = {"techName": sec, "repeatingSectionGrid": []}
            tabs[tab]["questions"].append({"field": secs[tab, sec]})
        value = answers.get(key, "")
        secs[tab, sec]["repeatingSectionGrid"].append(
            {"field": {"techName": fld, "__userAnswer": [value] if value else []}}
        )
    try:
        return all(bool(_compiled(q).evaluate(doc)) for q in queries)
    except Exception:
        return False


def _closest(options: tuple[str, ...], value: str) -> str:
    best = max(options, key=lambda o: fuzz.token_set_ratio(o, value), default=None)
    return best if best is not None and fuzz.token_set_ratio(best, value) >= FUZZ_MIN else value


def _logic_ok(matches: list[tuple[Leaf, Leaf]], g_leaves: list[Leaf]) -> int:
    """Golden SHOW fields whose matched counterpart is visible on exactly the same answer vectors."""
    g_by_key = {lf.key: lf for lf in g_leaves}
    o_for_g = {g.key: o for g, o in matches}
    ok = 0
    for g, o in matches:
        if not g.shows:
            continue
        refs = _refs(g.shows)
        domains = []
        for key, lits in refs.items():
            opts = g_by_key[key].options if key in g_by_key else ()
            domains.append([*sorted(set(opts) | lits), OTHER, ""])
        same = True
        for values in itertools.islice(itertools.product(*domains), MAX_VECTORS):
            g_ans = dict(zip(refs, values, strict=True))
            o_ans = {}
            for key, v in g_ans.items():
                if (o_ref := o_for_g.get(key)) is not None:
                    o_ans[o_ref.key] = _closest(o_ref.options, v) if v not in ("", OTHER) else v
            if _visible(g.shows, g_ans) != _visible(o.shows, o_ans):
                same = False
                break
        ok += same
    return ok
