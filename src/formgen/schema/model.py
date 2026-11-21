"""Pydantic model of the COI Generator Formularzy import file (FormDefinition).

Shape follows the golden files in data/input/02_przyklady_json, which are the
only ground truth. Where the golden files and importowanyPlikJsonSchemat.json
disagree (e.g. ``repeatingSectionGrid``), the golden files win.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator
from pydantic import Field as PField

EMPTY_HTML = "<html><head></head><body></body></html>"


class TabType(StrEnum):
    MAIN = "MAIN"
    FINISH = "FINISH"


class FieldType(StrEnum):
    SECTION = "SECTION"
    REPEATING_SECTION = "REPEATING_SECTION"
    TEXT_FIELD = "TEXT_FIELD"
    TEXTAREA = "TEXTAREA"
    NUMBER = "NUMBER"
    CHECKBOX = "CHECKBOX"
    RADIO = "RADIO"
    SELECT = "SELECT"
    DATEPICKER = "DATEPICKER"
    FILE_UPLOADER = "FILE_UPLOADER"
    CONSENT_SECTION = "CONSENT_SECTION"
    TEXT_BLOCK = "TEXT_BLOCK"
    INFO_SECTION = "INFO_SECTION"


CONTAINER_TYPES = frozenset({FieldType.SECTION, FieldType.REPEATING_SECTION})
INPUT_TYPES = frozenset(
    {
        FieldType.TEXT_FIELD,
        FieldType.TEXTAREA,
        FieldType.NUMBER,
        FieldType.CHECKBOX,
        FieldType.RADIO,
        FieldType.SELECT,
        FieldType.DATEPICKER,
        FieldType.FILE_UPLOADER,
        FieldType.CONSENT_SECTION,
    }
)
PRESENTATION_TYPES = frozenset({FieldType.TEXT_BLOCK, FieldType.INFO_SECTION})
OPTION_TYPES = frozenset({FieldType.CHECKBOX, FieldType.RADIO, FieldType.SELECT})
DICTIONARY_TYPES = OPTION_TYPES


class Validator(StrEnum):
    REQUIRED = "REQUIRED"
    EMAIL = "EMAIL"
    PESEL = "PESEL"
    NIP = "NIP"
    REGON = "REGON"
    ZIP_CODE = "ZIP_CODE"
    EPUAP = "EPUAP"
    ADE = "ADE"
    SERIAL_NUMBER_ID_CARD = "SERIAL_NUMBER_ID_CARD"


class StateType(StrEnum):
    SHOW = "SHOW"
    READ_ONLY = "READ_ONLY"


class DefaultValueType(StrEnum):
    EXTERNAL_SYSTEM = "EXTERNAL_SYSTEM"


def new_id() -> str:
    return str(uuid.uuid4())


class _Base(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True, use_enum_values=True)


class Option(_Base):
    id: str
    name: str
    techName: str | None = None


class State(_Base):
    type: StateType
    query: str


class Consent(_Base):
    description: str
    required: bool | None = None


class ConsentSectionConfig(_Base):
    consents: list[Consent] = PField(default_factory=list)
    required: bool | None = None
    files: list[Any] = PField(default_factory=list)


class Field(_Base):
    id: str = PField(default_factory=new_id)
    type: FieldType
    techName: str
    title: str = ""
    description: str = ""
    options: list[Option] = PField(default_factory=list)
    validation: list[Validator] = PField(default_factory=list)
    readOnly: bool = False
    repeatingSectionGrid: list[Question] = PField(default_factory=list)
    states: list[State] = PField(default_factory=list)
    questionOrder: int = 0
    tooltipMessage: str = ""
    # optional, serialised only when set (matches golden files)
    dictionaryName: str | None = None
    defaultValue: str | list[str] | None = None
    defaultValueType: DefaultValueType | None = None
    searchEnabled: bool | None = None
    multiLevelTree: bool | None = None
    selectAllEnabled: bool | None = None
    consentSectionConfig: ConsentSectionConfig | None = None

    @field_validator("validation", mode="before")
    @classmethod
    def _coerce_validation(cls, v: Any) -> Any:
        # golden files sometimes contain ``"validation": {}``
        if v is None or v == {}:
            return []
        return v

    @property
    def is_container(self) -> bool:
        return self.type in CONTAINER_TYPES

    def iter_fields(self) -> Iterator[Field]:
        """Depth-first over nested fields (excluding self)."""
        for q in self.repeatingSectionGrid:
            yield q.field
            yield from q.field.iter_fields()


class Question(_Base):
    x: int = 0
    y: int = 0
    rows: int = 1
    cols: int = 3
    field: Field
    minItemRows: int | None = None


class Tab(_Base):
    id: str = PField(default_factory=new_id)
    title: str
    type: TabType = TabType.MAIN
    questions: list[Question] = PField(default_factory=list)

    def iter_fields(self) -> Iterator[Field]:
        for q in self.questions:
            yield q.field
            yield from q.field.iter_fields()


class Link(_Base):
    id: str = PField(default_factory=new_id)
    source: str
    target: str


class Flow(_Base):
    links: list[Link] = PField(default_factory=list)


class FormDefinition(_Base):
    title: str
    tabs: list[Tab] = PField(default_factory=list)
    flow: Flow = PField(default_factory=Flow)

    def iter_fields(self) -> Iterator[tuple[Tab, Field]]:
        for tab in self.tabs:
            for f in tab.iter_fields():
                yield tab, f

    def to_json_dict(self) -> dict[str, Any]:
        """Serialise exactly like the golden files (optional keys omitted when None)."""
        return self.model_dump(mode="json", exclude_none=True)

    @classmethod
    def from_json_dict(cls, data: dict[str, Any]) -> FormDefinition:
        return cls.model_validate(data)


Field.model_rebuild()
Question.model_rebuild()
