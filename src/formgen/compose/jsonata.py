"""Build JSONata ``states[].query`` strings in exactly the golden-file dialect."""

import json


def literal(text: str, quote: str = '"') -> str:
    """A JSONata string literal for arbitrary text (quotes, apostrophes, backslashes, newlines).

    The golden dialect quotes paths with ``'`` and values with ``"``; that style is kept whenever the
    text allows it. ``jsonata-python`` cannot parse ``\\'``, so text containing an apostrophe is always
    emitted as a JSON-escaped double-quoted literal, which every JSONata engine reads identically.
    """
    body = json.dumps(text, ensure_ascii=False)[1:-1]
    if quote == "'" and "'" not in text:
        return "'" + body.replace('\\"', '"') + "'"
    return '"' + body + '"'


def answer_path(tab_title: str, section: str, field: str) -> str:
    return (
        f"tabs[{literal(tab_title, "'")} in title].questions[{literal(section, "'")} in field.techName]"
        f".field.repeatingSectionGrid[{literal(field, "'")} in field.techName].field.__userAnswer"
    )


def equals(tab_title: str, section: str, field: str, value: str) -> str:
    return f"({literal(value)} in {answer_path(tab_title, section, field)})"


def not_equals(tab_title: str, section: str, field: str, value: str) -> str:
    return f"$not({literal(value)} in {answer_path(tab_title, section, field)})"


def all_of(*queries: str) -> str:
    return " and ".join(queries) if len(queries) > 1 else queries[0]


def any_of(*queries: str) -> str:
    if len(queries) == 1:
        return queries[0]
    return " or ".join(f"({q})" if " and " in q else q for q in queries)
