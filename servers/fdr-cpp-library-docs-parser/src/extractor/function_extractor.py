"""Parse <memberdef kind="function"> elements into CppFunctionIr."""

import logging
from typing import Optional

from lxml import etree

from src.generated import (
    CppDocstringIr,
    CppFunctionIr,
    CppParameterIr,
)
from src.extractor.docstring_extractor import extract_docstring
from src.extractor.type_resolver import extract_template_params, parse_type_info

logger = logging.getLogger(__name__)


def extract_function(memberdef: etree._Element) -> Optional[CppFunctionIr]:
    """Extract a CppFunctionIr from a <memberdef kind="function"> element."""
    try:
        return _extract_function_inner(memberdef)
    except Exception:
        name = memberdef.findtext("name", default="<unknown>")
        logger.warning("Failed to extract function '%s'", name, exc_info=True)
        return None


def _extract_function_inner(memberdef: etree._Element) -> CppFunctionIr:
    name = memberdef.findtext("name", default="")
    qualified_name = memberdef.findtext("qualifiedname", default=name)
    definition = memberdef.findtext("definition", default="")
    argsstring = memberdef.findtext("argsstring", default="")
    signature = definition + argsstring

    type_elem = memberdef.find("type")
    return_type = parse_type_info(type_elem)

    template_params = extract_template_params(memberdef)
    parameters = _extract_parameters(memberdef)

    docstring = _extract_function_docstring(memberdef)

    is_static = memberdef.attrib.get("static", "no") == "yes"
    is_const = memberdef.attrib.get("const", "no") == "yes"
    is_constexpr = memberdef.attrib.get("constexpr", "no") == "yes"
    is_volatile = memberdef.attrib.get("volatile", "no") == "yes"
    is_inline = memberdef.attrib.get("inline", "no") == "yes"
    is_explicit = memberdef.attrib.get("explicit", "no") == "yes"
    is_noexcept = memberdef.attrib.get("noexcept", "no") == "yes"
    is_no_discard = memberdef.attrib.get("nodiscard", "no") == "yes"

    noexcept_expression = _extract_noexcept_expression(memberdef)
    is_deleted = "= delete" in argsstring

    virt_attr = memberdef.attrib.get("virt", "non-virtual")
    virtuality = virt_attr if virt_attr in ("non-virtual", "virtual", "pure-virtual") else "non-virtual"

    refqual_attr = memberdef.attrib.get("refqual")
    ref_qualifier = refqual_attr if refqual_attr in ("lvalue", "rvalue") else None

    requires_elem = memberdef.find("requiresclause")
    requires_clause = requires_elem.text if requires_elem is not None and requires_elem.text else None

    return CppFunctionIr(
        name=name,
        path=qualified_name,
        signature=signature,
        template_params=template_params,
        parameters=parameters,
        return_type=return_type,
        docstring=docstring,
        is_static=is_static,
        is_const=is_const,
        is_constexpr=is_constexpr,
        is_volatile=is_volatile,
        is_inline=is_inline,
        is_explicit=is_explicit,
        is_noexcept=is_noexcept,
        noexcept_expression=noexcept_expression,
        is_no_discard=is_no_discard,
        virtuality=virtuality,
        ref_qualifier=ref_qualifier,
        requires_clause=requires_clause,
        is_deleted=is_deleted,
    )


def _extract_parameters(memberdef: etree._Element) -> list[CppParameterIr]:
    """Extract function parameters from direct <param> children.

    Note: memberdef.findall("param") only returns direct children,
    so template params (nested inside <templateparamlist>) are never included.
    """
    params: list[CppParameterIr] = []
    for param_elem in memberdef.findall("param"):
        type_elem = param_elem.find("type")
        type_info = parse_type_info(type_elem)
        declname_elem = param_elem.find("declname")
        name = declname_elem.text if declname_elem is not None and declname_elem.text else ""
        defval_elem = param_elem.find("defval")
        default_value = parse_type_info(defval_elem)
        array_elem = param_elem.find("array")
        array_suffix = array_elem.text if array_elem is not None and array_elem.text else None
        params.append(
            CppParameterIr(
                name=name,
                type_info=type_info,
                default_value=default_value,
                array_suffix=array_suffix,
            )
        )
    return params


def _extract_noexcept_expression(memberdef: etree._Element) -> Optional[str]:
    """Extract and strip the noexcept expression."""
    expr = memberdef.attrib.get("noexceptexpression")
    if not expr:
        return None
    stripped = expr.strip()
    if stripped.startswith("noexcept(") and stripped.endswith(")"):
        stripped = stripped[len("noexcept("):-1]
    return stripped if stripped else None


def _extract_function_docstring(memberdef: etree._Element) -> Optional[CppDocstringIr]:
    """Extract docstring from a memberdef."""
    brief = memberdef.find("briefdescription")
    detail = memberdef.find("detaileddescription")
    return extract_docstring(brief, detail)
