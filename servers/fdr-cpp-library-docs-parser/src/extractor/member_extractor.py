"""Shared member-level extractors for typedefs and variables."""

import logging
from typing import Any, Callable, Optional

from lxml import etree

from src.generated import (
    CppTypedefIr,
    CppVariableIr,
)
from src.extractor.docstring_extractor import extract_docstring
from src.extractor.enum_extractor import extract_enum
from src.extractor.function_extractor import extract_function
from src.extractor.type_resolver import extract_template_params, parse_type_info

logger = logging.getLogger(__name__)


def extract_typedef(memberdef: etree._Element) -> Optional[CppTypedefIr]:
    """Extract a CppTypedefIr from a <memberdef kind="typedef">."""
    try:
        name = memberdef.findtext("name", default="")
        qualified_name = memberdef.findtext("qualifiedname", default=name)
        type_elem = memberdef.find("type")
        type_info = parse_type_info(type_elem)
        template_params = extract_template_params(memberdef)
        brief = memberdef.find("briefdescription")
        detail = memberdef.find("detaileddescription")
        docstring = extract_docstring(brief, detail)
        return CppTypedefIr(
            name=name,
            path=qualified_name,
            type_info=type_info,
            template_params=template_params,
            docstring=docstring,
        )
    except Exception:
        name = memberdef.findtext("name", default="<unknown>")
        logger.warning("Failed to extract typedef '%s'", name, exc_info=True)
        return None


def extract_variable(memberdef: etree._Element) -> Optional[CppVariableIr]:
    """Extract a CppVariableIr from a <memberdef kind="variable">."""
    try:
        name = memberdef.findtext("name", default="")
        qualified_name = memberdef.findtext("qualifiedname", default=name)
        type_elem = memberdef.find("type")
        type_info = parse_type_info(type_elem)
        initializer_elem = memberdef.find("initializer")
        initializer = initializer_elem.text if initializer_elem is not None and initializer_elem.text else None
        template_params = extract_template_params(memberdef)
        is_static = memberdef.attrib.get("static", "no") == "yes"
        is_constexpr = memberdef.attrib.get("constexpr", "no") == "yes"
        is_mutable = memberdef.attrib.get("mutable", "no") == "yes"
        brief = memberdef.find("briefdescription")
        detail = memberdef.find("detaileddescription")
        docstring = extract_docstring(brief, detail)
        return CppVariableIr(
            name=name,
            path=qualified_name,
            type_info=type_info,
            initializer=initializer,
            template_params=template_params,
            is_static=is_static,
            is_constexpr=is_constexpr,
            is_mutable=is_mutable,
            docstring=docstring,
        )
    except Exception:
        name = memberdef.findtext("name", default="<unknown>")
        logger.warning("Failed to extract variable '%s'", name, exc_info=True)
        return None


def extract_section_members(
    sectiondef: etree._Element,
    variable_hook: Optional[Callable[[etree._Element], bool]] = None,
) -> dict[str, list[Any]]:
    """Dispatch memberdef elements by kind and collect extracted IR objects.

    Args:
        sectiondef: A <sectiondef> element containing <memberdef> children.
        variable_hook: Optional callback for "variable" kind memberdefs.
            Called before default variable extraction.  If it returns True the
            memberdef is considered handled and default extraction is skipped.

    Returns:
        Dict with keys "functions", "typedefs", "enums", "variables".
    """
    result: dict[str, list[Any]] = {
        "functions": [],
        "typedefs": [],
        "enums": [],
        "variables": [],
    }
    for memberdef in sectiondef.findall("memberdef"):
        mk = memberdef.attrib.get("kind", "")
        if mk == "function":
            func = extract_function(memberdef)
            if func:
                result["functions"].append(func)
        elif mk == "enum":
            en = extract_enum(memberdef)
            if en:
                result["enums"].append(en)
        elif mk == "typedef":
            td = extract_typedef(memberdef)
            if td:
                result["typedefs"].append(td)
        elif mk == "variable":
            if variable_hook is not None and variable_hook(memberdef):
                continue
            var = extract_variable(memberdef)
            if var:
                result["variables"].append(var)
    return result
