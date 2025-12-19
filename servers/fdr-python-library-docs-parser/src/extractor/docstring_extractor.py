"""Extract DocstringIr from Griffe docstrings."""

from typing import Optional

from griffe import Docstring

from src.generated.library_docs import (
    DocstringExampleIr,
    DocstringIr,
    DocstringParamIr,
    DocstringRaisesIr,
    DocstringReturnsIr,
)


def extract_docstring(docstring: Optional[Docstring]) -> Optional[DocstringIr]:
    """
    Extract DocstringIr from a Griffe Docstring.

    Args:
        docstring: Griffe Docstring object, or None.

    Returns:
        DocstringIr if docstring exists, None otherwise.
    """
    if not docstring or not docstring.value:
        return None

    # Parse the docstring
    parsed = docstring.parsed

    summary: Optional[str] = None
    description: Optional[str] = None
    params: list[DocstringParamIr] = []
    returns: Optional[DocstringReturnsIr] = None
    raises: list[DocstringRaisesIr] = []
    examples: list[DocstringExampleIr] = []
    notes: list[str] = []
    warnings: list[str] = []

    for section in parsed:
        kind = section.kind.name.lower()

        if kind == "text":
            # First text section is summary, subsequent ones are description
            text = str(section.value).strip()
            if summary is None:
                summary = text
            else:
                if description:
                    description += "\n\n" + text
                else:
                    description = text

        elif kind == "parameters":
            for param in section.value:
                params.append(
                    DocstringParamIr(
                        name=param.name,
                        type=str(param.annotation) if param.annotation else None,
                        description=param.description or None,
                        default=str(param.default) if param.default else None,
                    )
                )

        elif kind == "returns":
            if section.value:
                ret = section.value[0] if isinstance(section.value, list) else section.value
                returns = DocstringReturnsIr(
                    type=str(ret.annotation) if hasattr(ret, "annotation") and ret.annotation else None,
                    description=ret.description if hasattr(ret, "description") else str(ret),
                )

        elif kind == "raises":
            for exc in section.value:
                raises.append(
                    DocstringRaisesIr(
                        type=str(exc.annotation) if exc.annotation else "Exception",
                        description=exc.description or None,
                    )
                )

        elif kind == "examples":
            for example in section.value:
                if hasattr(example, "value"):
                    examples.append(
                        DocstringExampleIr(
                            code=str(example.value),
                            description=example.description if hasattr(example, "description") else None,
                        )
                    )
                else:
                    examples.append(
                        DocstringExampleIr(
                            code=str(example),
                            description=None,
                        )
                    )

        elif kind == "notes":
            if isinstance(section.value, str):
                notes.append(section.value)
            else:
                notes.append(str(section.value))

        elif kind == "warnings" or kind == "warns":
            if isinstance(section.value, str):
                warnings.append(section.value)
            else:
                warnings.append(str(section.value))

    return DocstringIr(
        summary=summary,
        description=description,
        params=params,
        returns=returns,
        raises=raises,
        examples=examples,
        notes=notes,
        warnings=warnings,
    )
