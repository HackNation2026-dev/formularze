"""Build JSONata ``states[].query`` strings in exactly the golden-file dialect."""


def answer_path(tab_title: str, section: str, field: str) -> str:
    return (
        f"tabs['{tab_title}' in title].questions['{section}' in field.techName]"
        f".field.repeatingSectionGrid['{field}' in field.techName].field.__userAnswer"
    )


def equals(tab_title: str, section: str, field: str, value: str) -> str:
    return f'("{value}" in {answer_path(tab_title, section, field)})'


def not_equals(tab_title: str, section: str, field: str, value: str) -> str:
    return f'$not("{value}" in {answer_path(tab_title, section, field)})'


def all_of(*queries: str) -> str:
    return " and ".join(queries) if len(queries) > 1 else queries[0]


def any_of(*queries: str) -> str:
    if len(queries) == 1:
        return queries[0]
    return " or ".join(f"({q})" if " and " in q else q for q in queries)
