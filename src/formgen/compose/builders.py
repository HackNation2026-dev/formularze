"""Small constructors for Field/Question objects with golden-file defaults."""

from __future__ import annotations

from formgen.compose.slug import slug
from formgen.schema.model import (
    EMPTY_HTML,
    Consent,
    ConsentSectionConfig,
    DefaultValueType,
    Field,
    FieldType,
    Option,
    Question,
    State,
    StateType,
    Validator,
)

COLS = 3


def html(text: str) -> str:
    """Wrap plain text / inline HTML paragraphs the way the Generator stores descriptions."""
    if not text:
        return ""
    if text.startswith("<html>"):
        return text
    paras = [p.strip() for p in text.split("\n") if p.strip()]
    return "<html><head></head><body>" + "".join(f"<p>{p}</p>" for p in paras) + "</body></html>"


def show(query: str) -> State:
    return State(type=StateType.SHOW, query=query)


def option(name: str) -> Option:
    return Option(id=name, name=name, techName=slug(name))


def field(
    type_: FieldType,
    tech: str,
    title: str = "",
    *,
    description: str = "",
    options: list[str] | None = None,
    validation: list[Validator] | None = None,
    read_only: bool = False,
    states: list[State] | None = None,
    dictionary: str | None = None,
    default: str | list[str] | None = None,
    external: str | None = None,
    search: bool | None = None,
    multi_level: bool | None = None,
    tooltip: str = "",
) -> Field:
    f = Field(
        type=type_,
        techName=tech,
        title=title,
        description=html(description) if type_ not in (FieldType.TEXT_FIELD,) or description else description,
        options=[option(o) for o in options or []],
        validation=list(validation or []),
        readOnly=read_only,
        states=list(states or []),
        tooltipMessage=tooltip,
        dictionaryName=dictionary,
        searchEnabled=search,
        multiLevelTree=multi_level,
    )
    if external:
        f.defaultValue = external
        f.defaultValueType = DefaultValueType.EXTERNAL_SYSTEM
    elif default is not None:
        f.defaultValue = default
    return f


def text(tech: str, title: str, **kw) -> Field:
    return field(FieldType.TEXT_FIELD, tech, title, **kw)


def consent_section(tech: str, consents: list[tuple[str, bool]]) -> Field:
    f = field(FieldType.CONSENT_SECTION, tech)
    f.consentSectionConfig = ConsentSectionConfig(
        consents=[Consent(description=html(d), required=r) for d, r in consents], files=[]
    )
    return f


def section(
    tech: str,
    title: str,
    fields: list[Field],
    *,
    description: str = "",
    states: list[State] | None = None,
    repeating: bool = False,
) -> Question:
    """A SECTION question with its inner fields laid out one per row."""
    inner: list[Question] = []
    for i, f in enumerate(fields):
        f.questionOrder = i
        inner.append(Question(x=0, y=i, rows=1, cols=COLS, field=f))
    sec = Field(
        type=FieldType.REPEATING_SECTION if repeating else FieldType.SECTION,
        techName=tech,
        title=title,
        description=html(description) if description else EMPTY_HTML,
        repeatingSectionGrid=inner,
        states=list(states or []),
    )
    return Question(x=0, y=0, rows=len(fields) + 1, cols=COLS, field=sec)


def layout(questions: list[Question]) -> list[Question]:
    """Stack sections vertically: y cumulative, questionOrder == y (golden convention)."""
    y = 0
    for q in questions:
        q.x, q.y, q.cols = 0, y, COLS
        q.field.questionOrder = y
        y += q.rows
    return questions
