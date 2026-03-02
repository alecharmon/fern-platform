"""Pure XML-to-CppTypeInfo conversion and template parameter extraction."""

import logging
from typing import Optional

from lxml import etree

from src.generated import (
    CppTemplateParamIr,
    CppTypeInfo,
    CppTypeInfoPartsItem,
    CppTypeRef,
)

logger = logging.getLogger(__name__)


def parse_type_info(element: Optional[etree._Element]) -> Optional[CppTypeInfo]:
    """Convert an lxml <type> or <defval> element to CppTypeInfo."""
    if element is None:
        return None
    parts: list[CppTypeInfoPartsItem] = []
    if element.text:
        parts.append(element.text)
    for child in element:
        if child.tag == "ref":
            refid = child.attrib.get("refid", "")
            kindref = child.attrib.get("kindref", "")
            text = child.text or ""
            parts.append(CppTypeRef(text=text, refid=refid, kindref=kindref))
        else:
            if child.text:
                parts.append(child.text)
        if child.tail:
            parts.append(child.tail)
    if not parts:
        return None
    display = _parts_display(parts)
    return CppTypeInfo(parts=parts, display=display)


def _parts_display(parts: list[CppTypeInfoPartsItem]) -> str:
    """Concatenate all parts' text into a display string."""
    result: list[str] = []
    for p in parts:
        if isinstance(p, str):
            result.append(p)
        else:
            result.append(p.text)
    return "".join(result)


def extract_template_params(
    compound_elem: etree._Element,
) -> list[CppTemplateParamIr]:
    """Extract template parameters from a <templateparamlist> child."""
    tpl = compound_elem.find("templateparamlist")
    if tpl is None:
        return []
    params: list[CppTemplateParamIr] = []
    for param_elem in tpl.findall("param"):
        type_elem = param_elem.find("type")
        type_text = element_text_content(type_elem) if type_elem is not None else ""
        name = None
        declname_elem = param_elem.find("declname")
        defname_elem = param_elem.find("defname")
        if declname_elem is not None and declname_elem.text:
            name = declname_elem.text
        elif defname_elem is not None and defname_elem.text:
            name = defname_elem.text
        defval_elem = param_elem.find("defval")
        default_value = parse_type_info(defval_elem)
        is_variadic = "..." in type_text or (name is not None and "..." in name)
        if name and name.endswith("..."):
            name = name.rstrip(".")
        params.append(
            CppTemplateParamIr(
                type=type_text,
                name=name if name else None,
                default_value=default_value,
                is_variadic=is_variadic,
            )
        )
    return params


def element_text_content(elem: etree._Element) -> str:
    """Get all text content from an element, including children."""
    parts: list[str] = []
    if elem.text:
        parts.append(elem.text)
    for child in elem:
        if child.text:
            parts.append(child.text)
        if child.tail:
            parts.append(child.tail)
    return "".join(parts)


def has_documentation(memberdef: etree._Element) -> bool:
    """Check whether a memberdef has any documentation content.

    Returns True if the <briefdescription> or <detaileddescription> elements
    contain any text content, False otherwise.
    """
    for tag in ("briefdescription", "detaileddescription"):
        elem = memberdef.find(tag)
        if elem is not None and element_text_content(elem).strip():
            return True
    return False


def build_refid_map(index_xml_path: str) -> dict[str, str]:
    """Build refid->qualifiedName mapping from index.xml using iterparse."""
    refid_map: dict[str, str] = {}
    for event, elem in etree.iterparse(index_xml_path, events=("end",)):
        if elem.tag == "compound":
            refid = elem.attrib.get("refid", "")
            name_elem = elem.find("name")
            if refid and name_elem is not None and name_elem.text:
                refid_map[refid] = name_elem.text
            for member in elem.findall("member"):
                m_refid = member.attrib.get("refid", "")
                m_name = member.find("name")
                if m_refid and m_name is not None and m_name.text:
                    refid_map[m_refid] = m_name.text
            elem.clear()
    return refid_map
