"""FormSpec -> FormDefinition. Deterministic; the only place that knows the target layout."""

from __future__ import annotations

import itertools

from formgen.compose import jsonata as jq
from formgen.compose import templates as T
from formgen.compose.builders import consent_section, field, layout, section, show
from formgen.compose.slug import slug, unique
from formgen.compose.spec import Condition, FieldSpec, FormSpec, PageSpec, SectionSpec
from formgen.schema.model import (
    FieldType,
    Flow,
    FormDefinition,
    Link,
    Question,
    Tab,
    TabType,
    Validator,
)


def compose(spec: FormSpec) -> FormDefinition:
    v = spec.with_validators
    a = spec.applicant
    taken: set[str] = set()

    # ---- page 1: Dane ------------------------------------------------------------------------
    p1: list[Question] = [T.sec_urzad(spec.office_name, spec.office_is_organ, v)]
    if a.needs_subject_section:
        p1.append(T.sec_podmiot(a.self_person, a.other_person, a.legal_entity, v))
    p1.append(T.sec_twoje_dane(spec.identity_source, spec.include_pesel, v))
    p1.append(T.sec_adres("adres_zamieszkania", "Adres zamieszkania", "", v, mlpz=True))
    if a.legal_entity:
        p1.append(T.sec_dane_podmiotu(v))
        p1.append(T.sec_adres("adres_siedziby", "Adres siedziby", "_siedziba", v, states=[show(T.COND_PRAWNEJ)]))
        p1.append(T.sec_reprezentant(v))
    if a.other_person:
        p1.append(T.sec_dane_innej_osoby(v))
        p1.append(
            T.sec_adres(
                "adres_zamieszkania_osoby_ktorej_jestes_pelnomocnikiem",
                "Adres zamieszkania innej osoby",
                "_inna_osoba",
                v,
                states=[show(T.COND_INNEJ)],
            )
        )
    if a.other_person or a.legal_entity:
        p1.append(T.sec_pelnomocnictwo(a.other_person, a.legal_entity, v))
    if a.other_person:
        p1.append(T.sec_oplata_v1(spec.title, v))
    if a.legal_entity:
        p1.append(T.sec_oplata_v2(spec.title, v))
    tabs = [Tab(title=T.DANE, type=TabType.MAIN, questions=layout(p1))]
    for q in p1:
        taken.add(q.field.techName)
        taken.update(f.techName for f in q.field.iter_fields())
    # reserve the tech names of the template pages built later, so subject sections never collide with them
    for q in [T.sec_kontakt(v), T.sec_zgoda(spec.extra_consents), *T.sec_podglad(spec.summary_text)]:
        taken.add(q.field.techName)
        taken.update(f.techName for f in q.field.iter_fields())

    # ---- pages 2..n: subject of the application -----------------------------------------------
    for page in spec.pages:
        tabs.append(_build_page(page, v, taken))

    # ---- contact + consents --------------------------------------------------------------------
    tabs.append(
        Tab(
            title=spec.contact_page_title,
            type=TabType.MAIN,
            questions=layout([T.sec_kontakt(v), T.sec_zgoda(spec.extra_consents)]),
        )
    )
    # ---- finish ---------------------------------------------------------------------------------
    tabs.append(Tab(title="Strona końcowa", type=TabType.FINISH, questions=layout(T.sec_podglad(spec.summary_text))))

    links = [Link(source=s.id, target=t.id) for s, t in itertools.pairwise(tabs)]
    return FormDefinition(title=spec.title[:255], tabs=tabs, flow=Flow(links=links))


def _build_page(page: PageSpec, v: bool, taken: set[str]) -> Tab:
    # first pass: resolve tech names so conditions can reference them
    sec_tech: dict[str, str] = {}
    fld_tech: dict[str, tuple[str, str]] = {}  # field tech -> (section tech, field tech)
    resolved: list[tuple[SectionSpec, str, list[tuple[FieldSpec, str]]]] = []
    for s in page.sections:
        st = unique(s.tech_name or slug(s.title), taken)
        sec_tech[st] = st
        fields = []
        for f in s.fields:
            ft = unique(f.tech_name or slug(f.label), taken)
            fld_tech[ft] = (st, ft)
            if f.tech_name:
                fld_tech[f.tech_name] = (st, ft)
            fields.append((f, ft))
        resolved.append((s, st, fields))

    def cond_query(conds: list[Condition]) -> list:
        qs = []
        for c in conds:
            ref = fld_tech.get(c.field) or fld_tech.get(slug(c.field))
            if ref is None:
                continue  # dangling reference: drop silently, validator would flag jsonata otherwise
            sec, fld = ref
            qs.append(
                jq.not_equals(page.title, sec, fld, c.value) if c.negate else jq.equals(page.title, sec, fld, c.value)
            )
        return [show(jq.all_of(*qs))] if qs else []

    questions: list[Question] = []
    for s, st, fields in resolved:
        built = [_build_field(f, ft, v, cond_query(f.visible_when)) for f, ft in fields]
        questions.append(
            section(
                st, s.title, built, description=s.description, states=cond_query(s.visible_when), repeating=s.repeating
            )
        )
    return Tab(title=page.title, type=TabType.MAIN, questions=layout(questions))


def _build_field(f: FieldSpec, tech: str, v: bool, states: list):
    if f.kind == FieldType.CONSENT_SECTION:
        fld = consent_section(tech, f.consents or [(f.label, f.required)])
        fld.states = states
        return fld
    validation: list[Validator] = []
    if v:
        if f.required and f.kind not in (FieldType.TEXT_BLOCK, FieldType.INFO_SECTION):
            validation.append(Validator.REQUIRED)
        validation += [x for x in f.validators if x not in validation]
    kw = {
        "description": f.description,
        "validation": validation,
        "read_only": f.read_only or bool(f.initial_data),
        "states": states,
        "tooltip": f.tooltip,
    }
    if f.kind in (FieldType.RADIO, FieldType.CHECKBOX, FieldType.SELECT):
        kw["options"] = [] if f.dictionary else f.options
        kw["dictionary"] = f.dictionary
        if f.kind == FieldType.SELECT:
            kw["search"] = bool(f.dictionary) or len(f.options) > 15
        if f.default:
            kw["default"] = [f.default]
    elif f.initial_data:
        kw["external"] = f.initial_data
    elif f.default:
        kw["default"] = f.default
    title = "" if f.kind in (FieldType.TEXT_BLOCK,) else f.label
    return field(f.kind, tech, title, **kw)
