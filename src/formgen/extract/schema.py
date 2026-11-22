"""Flat intermediate output of the LLM (constrained decoding target). Kept shallow on purpose:
small models lose accuracy on deep nested schemas ("constraint tax"), so the nested
FormDefinition is assembled in code from this."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Kind = Literal[
    "TEXT_FIELD", "TEXTAREA", "NUMBER", "DATEPICKER", "RADIO", "CHECKBOX", "SELECT", "FILE_UPLOADER", "TEXT_BLOCK"
]
ValidatorName = Literal["", "EMAIL", "PESEL", "NIP", "REGON", "ZIP_CODE", "EPUAP", "ADE", "SERIAL_NUMBER_ID_CARD"]


class LlmCondition(BaseModel):
    field_line: int = 0  # line of the controlling RADIO/CHECKBOX/SELECT field
    option_line: int = 0  # line of the option that shows this field or section


class LlmField(BaseModel):
    """Points at numbered source lines; code resolves the text, so the model never re-types labels or options."""

    line: int
    label: str = ""  # override, only when the line text is not a usable label
    kind: Kind = "TEXT_FIELD"
    option_lines: list[int] = Field(default_factory=list)
    required: bool = True
    validator: ValidatorName = ""
    description: str = ""
    visible_when: LlmCondition | None = None


class LlmSection(BaseModel):
    page_title: str
    title: str
    description: str = ""
    repeating: bool = False
    visible_when: LlmCondition | None = None
    fields: list[LlmField] = Field(default_factory=list)


class LlmGlobal(BaseModel):
    title: str
    office_name: str = ""
    office_is_organ: bool = False
    applicant_self: bool = True
    applicant_other_person: bool = False
    applicant_legal_entity: bool = False
    reasoning: str = ""


class LlmChunk(BaseModel):
    sections: list[LlmSection] = Field(default_factory=list)


def json_schema(model: type[BaseModel]) -> dict:
    """Inline, $ref-free schema (llama.cpp's grammar converter silently drops nested $ref)."""
    s = model.model_json_schema(ref_template="#/$defs/{model}")
    defs = s.pop("$defs", {})

    def inline(node, in_properties: bool = False):
        if isinstance(node, dict):
            if "$ref" in node:
                name = node["$ref"].split("/")[-1]
                return inline(defs[name])
            out = {}
            for k, v in node.items():
                if not in_properties and k in ("title", "default"):
                    continue  # schema metadata, not a property named "title"
                out[k] = inline(v, in_properties=(k == "properties"))
            return out
        if isinstance(node, list):
            return [inline(x) for x in node]
        return node

    return inline(s)
