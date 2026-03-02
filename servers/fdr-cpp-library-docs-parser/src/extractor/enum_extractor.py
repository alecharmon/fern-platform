"""Parse <memberdef kind="enum"> elements into CppEnumIr."""

import logging
from typing import Optional

from lxml import etree

from src.generated import (
    CppEnumIr,
    CppEnumValueIr,
)
from src.extractor.docstring_extractor import extract_docstring
from src.extractor.type_resolver import element_text_content

logger = logging.getLogger(__name__)


def extract_enum(memberdef: etree._Element) -> Optional[CppEnumIr]:
    """Extract a CppEnumIr from a <memberdef kind="enum"> element."""
    try:
        return _extract_enum_inner(memberdef)
    except Exception:
        name = memberdef.findtext("name", default="<unknown>")
        logger.warning("Failed to extract enum '%s'", name, exc_info=True)
        return None


def _extract_enum_inner(memberdef: etree._Element) -> CppEnumIr:
    name = memberdef.findtext("name", default="")
    qualified_name = memberdef.findtext("qualifiedname", default=name)
    is_scoped = memberdef.attrib.get("strong", "no") == "yes"

    underlying_type = None
    type_elem = memberdef.find("type")
    if type_elem is not None:
        type_text = element_text_content(type_elem).strip()
        if type_text:
            underlying_type = type_text

    values = _extract_enum_values(memberdef)

    brief = memberdef.find("briefdescription")
    detail = memberdef.find("detaileddescription")
    docstring = extract_docstring(brief, detail)

    return CppEnumIr(
        name=name,
        path=qualified_name,
        is_scoped=is_scoped,
        underlying_type=underlying_type,
        values=values,
        docstring=docstring,
    )


def _extract_enum_values(memberdef: etree._Element) -> list[CppEnumValueIr]:
    """Extract enum values from child <enumvalue> elements."""
    values: list[CppEnumValueIr] = []
    for ev in memberdef.findall("enumvalue"):
        name = ev.findtext("name", default="")
        refid = ev.attrib.get("id")
        initializer_elem = ev.find("initializer")
        initializer = initializer_elem.text if initializer_elem is not None and initializer_elem.text else None

        brief = ev.find("briefdescription")
        detail = ev.find("detaileddescription")
        docstring = extract_docstring(brief, detail)

        values.append(
            CppEnumValueIr(
                name=name,
                id=refid,
                initializer=initializer,
                docstring=docstring,
            )
        )
    return values
