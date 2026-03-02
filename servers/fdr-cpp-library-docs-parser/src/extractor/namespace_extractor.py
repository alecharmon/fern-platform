"""Parse <compounddef kind="namespace"> elements into CppNamespaceIr kwargs."""

import logging
from typing import Any, Optional

from lxml import etree

from src.generated import (
    CppConceptIr,
)
from src.extractor.docstring_extractor import extract_docstring
from src.extractor.member_extractor import extract_section_members
from src.extractor.type_resolver import (
    extract_template_params,
    element_text_content,
)

logger = logging.getLogger(__name__)


def extract_namespace(
    compounddef: etree._Element,
) -> Optional[tuple[dict[str, Any], list[str], list[str]]]:
    """Extract namespace data from a <compounddef kind="namespace">.

    Returns (kwargs_dict, inner_namespace_refids, inner_class_refids) or None.
    """
    try:
        return _extract_namespace_inner(compounddef)
    except Exception:
        name = compounddef.findtext("compoundname", default="<unknown>")
        logger.warning("Failed to extract namespace '%s'", name, exc_info=True)
        return None


def _extract_namespace_inner(
    compounddef: etree._Element,
) -> tuple[dict[str, Any], list[str], list[str]]:
    compound_name = compounddef.findtext("compoundname", default="")
    name = compound_name.rsplit("::", 1)[-1] if "::" in compound_name else compound_name

    brief = compounddef.find("briefdescription")
    detail = compounddef.find("detaileddescription")
    docstring = extract_docstring(brief, detail)

    concepts: list[CppConceptIr] = []

    def _concept_hook(memberdef: etree._Element) -> bool:
        if _is_concept(memberdef):
            concept = _extract_concept(memberdef)
            if concept:
                concepts.append(concept)
            return True
        return False

    functions: list[Any] = []
    enums: list[Any] = []
    typedefs: list[Any] = []
    variables: list[Any] = []

    for sectiondef in compounddef.findall("sectiondef"):
        members = extract_section_members(sectiondef, variable_hook=_concept_hook)
        functions.extend(members["functions"])
        enums.extend(members["enums"])
        typedefs.extend(members["typedefs"])
        variables.extend(members["variables"])

    inner_ns_refids: list[str] = []
    for ins in compounddef.findall("innernamespace"):
        refid = ins.attrib.get("refid")
        if refid:
            inner_ns_refids.append(refid)

    inner_class_refids: list[str] = []
    for ic in compounddef.findall("innerclass"):
        refid = ic.attrib.get("refid")
        if refid:
            inner_class_refids.append(refid)

    kwargs: dict[str, Any] = {
        "name": name,
        "path": compound_name,
        "docstring": docstring,
        "functions": functions,
        "enums": enums,
        "typedefs": typedefs,
        "variables": variables,
        "concepts": concepts,
    }
    return kwargs, inner_ns_refids, inner_class_refids


def _is_concept(memberdef: etree._Element) -> bool:
    """Detect concept heuristic: kind=variable, constexpr=yes, type=bool, has templateparamlist."""
    if memberdef.attrib.get("constexpr", "no") != "yes":
        return False
    type_elem = memberdef.find("type")
    if type_elem is None:
        return False
    type_text = element_text_content(type_elem).strip()
    if type_text != "bool":
        return False
    tpl = memberdef.find("templateparamlist")
    if tpl is None or len(tpl) == 0:
        return False
    return True


def _extract_concept(memberdef: etree._Element) -> Optional[CppConceptIr]:
    """Extract a CppConceptIr from a variable memberdef detected as a concept."""
    try:
        name = memberdef.findtext("name", default="")
        qualified_name = memberdef.findtext("qualifiedname", default=name)
        template_params = extract_template_params(memberdef)
        initializer_elem = memberdef.find("initializer")
        constraint_expression = None
        if initializer_elem is not None and initializer_elem.text:
            constraint_expression = initializer_elem.text.lstrip("= ").strip()
            if not constraint_expression:
                constraint_expression = None
        brief = memberdef.find("briefdescription")
        detail = memberdef.find("detaileddescription")
        docstring = extract_docstring(brief, detail)
        return CppConceptIr(
            name=name,
            path=qualified_name,
            template_params=template_params,
            constraint_expression=constraint_expression,
            docstring=docstring,
        )
    except Exception:
        name = memberdef.findtext("name", default="<unknown>")
        logger.warning("Failed to extract concept '%s'", name, exc_info=True)
        return None


