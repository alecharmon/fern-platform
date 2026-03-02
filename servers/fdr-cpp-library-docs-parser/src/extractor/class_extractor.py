"""Parse <compounddef kind="class|struct"> elements into CppClassIr kwargs."""

import logging
from typing import Any, Optional

from lxml import etree

from src.generated import (
    CppBaseClassRef,
    CppEnumIr,
    CppFunctionIr,
    CppTypedefIr,
    CppVariableIr,
)
from src.extractor.docstring_extractor import extract_docstring
from src.extractor.enum_extractor import extract_enum
from src.extractor.function_extractor import extract_function
from src.extractor.member_extractor import extract_typedef, extract_variable
from src.extractor.type_resolver import (
    extract_template_params,
    element_text_content,
    has_documentation,
)

logger = logging.getLogger(__name__)


def extract_class(
    compounddef: etree._Element,
) -> Optional[tuple[dict[str, Any], list[str]]]:
    """Extract class/struct data from a <compounddef>.

    Returns (kwargs_dict, inner_class_refids) or None on failure.
    The kwargs_dict contains all fields needed to construct CppClassIr
    except inner_classes (resolved in Phase 2).
    """
    try:
        return _extract_class_inner(compounddef)
    except Exception:
        name = compounddef.findtext("compoundname", default="<unknown>")
        logger.warning("Failed to extract class '%s'", name, exc_info=True)
        return None


def _extract_class_inner(
    compounddef: etree._Element,
) -> tuple[dict[str, Any], list[str]]:
    compound_name = compounddef.findtext("compoundname", default="")
    kind_attr = compounddef.attrib.get("kind", "class")
    kind = "class" if kind_attr == "class" else "struct"
    name = compound_name.rsplit("::", 1)[-1] if "::" in compound_name else compound_name

    template_params = extract_template_params(compounddef)
    base_classes = _extract_base_classes(compounddef, "basecompoundref")
    derived_classes = _extract_base_classes(compounddef, "derivedcompoundref")

    brief = compounddef.find("briefdescription")
    detail = compounddef.find("detaileddescription")
    docstring = extract_docstring(brief, detail)

    is_abstract = compounddef.attrib.get("abstract", "no") == "yes"
    is_final = compounddef.attrib.get("final", "no") == "yes"

    includes_elem = compounddef.find("includes")
    include_header = includes_elem.text if includes_elem is not None and includes_elem.text else None

    methods: list[CppFunctionIr] = []
    static_methods: list[CppFunctionIr] = []
    friend_functions: list[CppFunctionIr] = []
    typedefs: list[CppTypedefIr] = []
    member_variables: list[CppVariableIr] = []
    enums: list[CppEnumIr] = []
    related_member_refs: list[str] = []
    section_labels: dict[str, str] = {}

    for sectiondef in compounddef.findall("sectiondef"):
        sec_kind = sectiondef.attrib.get("kind", "")
        header_elem = sectiondef.find("header")
        header_text = header_elem.text if header_elem is not None and header_elem.text else None

        if sec_kind == "related":
            for member in sectiondef.findall("member"):
                refid = member.attrib.get("refid")
                if refid:
                    related_member_refs.append(refid)
            continue

        for memberdef in sectiondef.findall("memberdef"):
            mk = memberdef.attrib.get("kind", "")
            extracted = False
            if mk in ("function", "friend"):
                func = _extract_member_function(memberdef, sec_kind)
                if func is None:
                    continue
                extracted = True
                if sec_kind in ("public-static-func", "protected-static-func"):
                    static_methods.append(func)
                elif sec_kind == "friend":
                    friend_functions.append(func)
                elif sec_kind in ("public-func", "protected-func") or sec_kind == "user-defined":
                    methods.append(func)
                else:
                    methods.append(func)
            elif mk == "typedef":
                td = extract_typedef(memberdef)
                if td:
                    extracted = True
                    typedefs.append(td)
            elif mk == "variable":
                var = extract_variable(memberdef)
                if var:
                    extracted = True
                    member_variables.append(var)
            elif mk == "enum":
                en = extract_enum(memberdef)
                if en:
                    extracted = True
                    enums.append(en)

            if extracted and header_text and sec_kind == "user-defined":
                member_id = memberdef.attrib.get("id", "")
                if member_id:
                    section_labels[member_id] = header_text

    inner_class_refids: list[str] = []
    for ic in compounddef.findall("innerclass"):
        refid = ic.attrib.get("refid")
        if refid:
            inner_class_refids.append(refid)

    kwargs: dict[str, Any] = {
        "name": name,
        "path": compound_name,
        "kind": kind,
        "template_params": template_params,
        "base_classes": base_classes,
        "derived_classes": derived_classes,
        "docstring": docstring,
        "is_abstract": is_abstract,
        "is_final": is_final,
        "include_header": include_header,
        "methods": methods,
        "static_methods": static_methods,
        "friend_functions": friend_functions,
        "typedefs": typedefs,
        "member_variables": member_variables,
        "enums": enums,
        "related_member_refs": related_member_refs,
        "section_labels": section_labels,
    }
    return kwargs, inner_class_refids


def _extract_member_function(
    memberdef: etree._Element,
    sec_kind: str,
) -> Optional[CppFunctionIr]:
    """Extract a member function, filtering friend type declarations and undocumented friends."""
    mk = memberdef.attrib.get("kind", "")
    if sec_kind == "friend" or mk == "friend":
        type_elem = memberdef.find("type")
        if type_elem is not None:
            type_text = element_text_content(type_elem).strip()
            if type_text in ("struct", "class"):
                return None
        prot = memberdef.attrib.get("prot", "public")
        if prot != "public":
            return None
        if not has_documentation(memberdef):
            return None
    return extract_function(memberdef)


def _extract_base_classes(
    compounddef: etree._Element,
    tag: str,
) -> list[CppBaseClassRef]:
    """Extract base/derived class references."""
    refs: list[CppBaseClassRef] = []
    for elem in compounddef.findall(tag):
        name = element_text_content(elem).strip()
        refid = elem.attrib.get("refid")
        prot = elem.attrib.get("prot", "public")
        access = prot if prot in ("public", "private", "protected") else "public"
        virt = elem.attrib.get("virt", "non-virtual")
        is_virtual = virt == "virtual"

        type_info = None
        if refid:
            from src.generated import CppTypeInfo, CppTypeRef
            parts = [CppTypeRef(text=name, refid=refid, kindref="compound")]
            type_info = CppTypeInfo(parts=parts, display=name)

        refs.append(
            CppBaseClassRef(
                name=name,
                type_info=type_info,
                access=access,
                is_virtual=is_virtual,
            )
        )
    return refs


