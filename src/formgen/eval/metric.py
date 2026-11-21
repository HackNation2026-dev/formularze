"""Structure-aware comparison of a generated FormDefinition against a golden one.

Leaf fields are matched per tab by techName (exact) or title (rapidfuzz
token_set_ratio >= 80). Reports precision/recall/F1 of fields, type accuracy on
matched fields, section-title accuracy, SHOW-state recall and a composite score.
The same report is computed separately for template tabs (Dane, Kontakt, Strona
końcowa: built from fixed templates, so they score high almost for free) and for
subject-of-application tabs (what the extractor actually has to find).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from rapidfuzz import fuzz

from formgen.schema.model import CONTAINER_TYPES, FormDefinition

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


@dataclass
class Report:
    tp: int = 0
    fp: int = 0
    fn: int = 0
    type_ok: int = 0
    section_ok: int = 0
    show_tp: int = 0
    show_total: int = 0
    unmatched_golden: list[str] = field(default_factory=list)
    unmatched_ours: list[str] = field(default_factory=list)
    subject: Report | None = None
    template: Report | None = None

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
            f"section={self.section_acc:.2f} show={self.show_recall:.2f} composite={self.composite():.2f} "
            f"F1_subject={self.f1_subject:.2f} F1_template={self.f1_template:.2f}"
        )


def leaves(form: FormDefinition, tabs: set[str] | None = None) -> list[Leaf]:
    out: list[Leaf] = []
    for tab in form.tabs:
        if tabs and tab.title not in tabs:
            continue
        for q in tab.questions:
            sec = q.field
            for f in sec.iter_fields():
                if f.type in CONTAINER_TYPES:
                    continue
                out.append(
                    Leaf(tab.title, sec.title, f.techName, f.title, str(f.type), bool(f.states) or bool(sec.states))
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
        setattr(r, part, _compare(g_part, o_part))
    return r


def _compare(g_leaves: list[Leaf], o_leaves: list[Leaf]) -> Report:
    r = Report()
    used: set[int] = set()
    for g in g_leaves:
        best = None
        for i, o in enumerate(o_leaves):
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
