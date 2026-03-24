"""Orchestrator: memory-safe XML parsing and two-phase IR construction."""

import gc
import logging
from pathlib import Path
from typing import Any, Optional, TypedDict

from lxml import etree

from src.generated import (
    CppClassIr,
    CppDocstringIr,
    CppGroupIr,
    CppLibraryDocsIr,
    CppNamespaceIr,
    IrMetadata,
)
from src.extractor.class_extractor import extract_class
from src.extractor.docstring_extractor import extract_docstring, set_aliases
from src.extractor.member_extractor import extract_section_members
from src.extractor.namespace_extractor import extract_namespace
from src.extractor.type_resolver import build_refid_map

logger = logging.getLogger(__name__)


class GroupData(TypedDict):
    id: str
    name: str
    title: str
    docstring: Optional[CppDocstringIr]
    member_refs: list[str]
    inner_class_refs: list[str]
    inner_namespace_refs: list[str]
    subgroup_refids: list[str]
    extracted_members: dict[str, dict[str, list[Any]]]


def extract_library_docs(
    xml_dir: Path,
    metadata: IrMetadata,
    aliases: dict[str, str] | None = None,
) -> CppLibraryDocsIr:
    """Parse Doxygen XML output and build CppLibraryDocsIr.

    Args:
        xml_dir: Path to the Doxygen XML output directory containing index.xml.
        metadata: Library metadata to include in the IR.
        aliases: Doxygen ALIASES extracted from the customer's Doxyfile.

    Returns:
        The fully constructed CppLibraryDocsIr.
    """
    if aliases is None:
        aliases = {}

    # Make aliases available to docstring_extractor for RST verbatim processing
    set_aliases(aliases)

    try:
        index_xml = xml_dir / "index.xml"
        if not index_xml.exists():
            raise FileNotFoundError(f"index.xml not found at {index_xml}")

        compounds = _parse_index(str(index_xml))
        refid_map = build_refid_map(str(index_xml))

        # Phase 1: Process each compound XML file
        ns_data: dict[str, tuple[dict[str, Any], list[str], list[str]]] = {}
        class_data: dict[str, tuple[dict[str, Any], list[str]]] = {}
        group_data: dict[str, GroupData] = {}

        for i, (refid, kind, _name) in enumerate(compounds):
            xml_file = xml_dir / f"{refid}.xml"
            if not xml_file.exists():
                logger.warning("Compound XML not found: %s", xml_file)
                continue

            try:
                tree = etree.parse(str(xml_file))
                root = tree.getroot()
                compounddef = root.find("compounddef")
                if compounddef is None:
                    continue

                if kind == "namespace":
                    result = extract_namespace(compounddef)
                    if result:
                        ns_data[refid] = result
                elif kind in ("class", "struct"):
                    result = extract_class(compounddef)
                    if result:
                        class_data[refid] = result
                elif kind == "group":
                    result = _extract_group(compounddef, refid)
                    if result:
                        group_data[refid] = result
            except Exception:
                logger.error("[cpp-extractor] Failed to process compound %s (%s)", refid, kind, exc_info=True)
            finally:
                # Periodic GC to bound memory without per-iteration overhead
                if (i + 1) % 50 == 0:
                    gc.collect()

        # Phase 1.5: Merge group-extracted members into their parent namespaces.
        # Group XML files may contain memberdef elements (typedefs, functions, etc.)
        # that are NOT duplicated in the namespace XML.  Without this merge those
        # members (and their docstrings, including <xrefsect> deprecation) would be
        # lost from the IR.
        _merge_group_members_into_namespaces(group_data, ns_data)

        # Phase 2: Build IR bottom-up
        built_classes: dict[str, CppClassIr] = {}
        _build_classes_bottom_up(class_data, built_classes)

        built_namespaces: dict[str, CppNamespaceIr] = {}
        _build_namespaces_bottom_up(ns_data, built_classes, built_namespaces)

        # Build root namespace
        top_level_ns = _find_top_level_namespaces(ns_data, built_namespaces)
        root_namespace = CppNamespaceIr(
            name="",
            path="",
            classes=[],
            functions=[],
            enums=[],
            typedefs=[],
            variables=[],
            concepts=[],
            namespaces=top_level_ns,
        )

        # Build groups
        groups = _build_groups(group_data)

        return CppLibraryDocsIr(
            metadata=metadata,
            root_namespace=root_namespace,
            groups=groups,
        )
    finally:
        set_aliases({})  # Reset to prevent stale state on Lambda warm start


def _parse_index(index_xml_path: str) -> list[tuple[str, str, str]]:
    """Parse index.xml to get list of (refid, kind, name) compounds."""
    compounds: list[tuple[str, str, str]] = []
    for event, elem in etree.iterparse(index_xml_path, events=("end",)):
        if elem.tag == "compound":
            refid = elem.attrib.get("refid", "")
            kind = elem.attrib.get("kind", "")
            name_elem = elem.find("name")
            name = name_elem.text if name_elem is not None and name_elem.text else ""
            if kind in ("namespace", "class", "struct", "group"):
                compounds.append((refid, kind, name))
            elem.clear()
    return compounds


def _build_classes_bottom_up(
    class_data: dict[str, tuple[dict[str, Any], list[str]]],
    built_classes: dict[str, CppClassIr],
) -> None:
    """Build CppClassIr objects sorted by nesting depth (deepest first)."""
    sorted_refids = sorted(
        class_data.keys(),
        key=lambda r: class_data[r][0].get("path", "").count("::"),
        reverse=True,
    )
    for refid in sorted_refids:
        kwargs, inner_refids = class_data[refid]
        inner_classes: list[CppClassIr] = []
        for ic_refid in inner_refids:
            if ic_refid in built_classes:
                inner_classes.append(built_classes[ic_refid])
        kwargs["inner_classes"] = inner_classes
        try:
            built_classes[refid] = CppClassIr(**kwargs)
        except Exception:
            logger.error("[cpp-extractor] Failed to construct CppClassIr for %s", refid, exc_info=True)


def _build_namespaces_bottom_up(
    ns_data: dict[str, tuple[dict[str, Any], list[str], list[str]]],
    built_classes: dict[str, CppClassIr],
    built_namespaces: dict[str, CppNamespaceIr],
) -> None:
    """Build CppNamespaceIr objects sorted by nesting depth (deepest first)."""
    sorted_refids = sorted(
        ns_data.keys(),
        key=lambda r: ns_data[r][0].get("path", "").count("::"),
        reverse=True,
    )
    for refid in sorted_refids:
        kwargs, inner_ns_refids, inner_class_refids = ns_data[refid]
        classes: list[CppClassIr] = []
        for ic_refid in inner_class_refids:
            if ic_refid in built_classes:
                classes.append(built_classes[ic_refid])
        namespaces: list[CppNamespaceIr] = []
        for ins_refid in inner_ns_refids:
            if ins_refid in built_namespaces:
                namespaces.append(built_namespaces[ins_refid])
        kwargs["classes"] = classes
        kwargs["namespaces"] = namespaces
        try:
            built_namespaces[refid] = CppNamespaceIr(**kwargs)
        except Exception:
            logger.error("[cpp-extractor] Failed to construct CppNamespaceIr for %s", refid, exc_info=True)


def _find_top_level_namespaces(
    ns_data: dict[str, tuple[dict[str, Any], list[str], list[str]]],
    built_namespaces: dict[str, CppNamespaceIr],
) -> list[CppNamespaceIr]:
    """Find namespaces that are not children of other namespaces."""
    child_refids: set[str] = set()
    for _refid, (_kwargs, inner_ns_refids, _inner_class_refids) in ns_data.items():
        for ins_refid in inner_ns_refids:
            child_refids.add(ins_refid)

    top_level: list[CppNamespaceIr] = []
    for refid in ns_data:
        if refid not in child_refids and refid in built_namespaces:
            top_level.append(built_namespaces[refid])
    return top_level


def _merge_unique_members(
    ns_kwargs: dict[str, Any],
    new_members: list[Any],
    key: str,
) -> None:
    dedup_attr = "signature" if key == "functions" else "path"
    existing_keys = {getattr(m, dedup_attr, "") for m in ns_kwargs.get(key, [])}
    for member in new_members:
        member_key = getattr(member, dedup_attr, "")
        if member_key not in existing_keys:
            existing_keys.add(member_key)
            ns_kwargs.setdefault(key, []).append(member)


def _merge_group_members_into_namespaces(
    group_data: dict[str, GroupData],
    ns_data: dict[str, tuple[dict[str, Any], list[str], list[str]]],
) -> None:
    """Merge members extracted from group XML files into their parent namespaces.

    Group XML files may be the sole location of certain memberdef elements
    (typedefs, functions, enums, variables) that don't appear in the namespace
    XML as full memberdef elements.  This function transfers those members into
    the namespace kwargs dicts so they end up in the final IR.

    To avoid duplicates, each member's qualified path is checked against the
    existing members already present in the namespace.
    """
    # Build a lookup: namespace path -> ns_data refid
    ns_path_to_refid: dict[str, str] = {}
    for refid, (kwargs, _inner_ns, _inner_cls) in ns_data.items():
        ns_path_to_refid[kwargs.get("path", "")] = refid

    for _group_refid, gdata in group_data.items():
        extracted = gdata["extracted_members"]
        if not extracted:
            continue
        for ns_path, members in extracted.items():
            target_refid = ns_path_to_refid.get(ns_path)
            if target_refid is None:
                continue
            ns_kwargs = ns_data[target_refid][0]

            for key in ("functions", "typedefs", "enums", "variables"):
                _merge_unique_members(ns_kwargs, members.get(key, []), key)


def _extract_group(
    compounddef: etree._Element,
    refid: str,
) -> Optional[GroupData]:
    """Extract group data from a <compounddef kind="group">.

    In addition to collecting member refids, this also fully extracts each
    memberdef (typedefs, functions, enums, variables) so that their docstrings
    (including <xrefsect> deprecation notices) are captured.  The extracted
    members are stored in ``extracted_members`` keyed by their parent namespace
    path so they can be merged into the appropriate namespace during Phase 2.
    """
    try:
        name = compounddef.findtext("compoundname", default="")
        title = compounddef.findtext("title", default=name)

        brief = compounddef.find("briefdescription")
        detail = compounddef.find("detaileddescription")
        docstring = extract_docstring(brief, detail)

        member_refs: list[str] = []
        # extracted_members: namespace_path -> {functions, typedefs, enums, variables}
        extracted_members: dict[str, dict[str, list[Any]]] = {}

        for sectiondef in compounddef.findall("sectiondef"):
            # Collect member_refs (IDs) from all memberdefs first
            for memberdef in sectiondef.findall("memberdef"):
                mk = memberdef.attrib.get("kind", "")
                if mk == "define":
                    continue
                m_id = memberdef.attrib.get("id")
                if m_id:
                    member_refs.append(m_id)

            # Extract members via shared dispatch
            section_members = extract_section_members(sectiondef)

            # Distribute extracted members by parent namespace path
            for key in ("functions", "typedefs", "enums", "variables"):
                for member in section_members[key]:
                    ns_path = getattr(member, "path", "")
                    ns_path = ns_path.rsplit("::", 1)[0] if "::" in ns_path else ""
                    ns_bucket = extracted_members.setdefault(ns_path, {
                        "functions": [],
                        "typedefs": [],
                        "enums": [],
                        "variables": [],
                    })
                    ns_bucket[key].append(member)

        inner_class_refs: list[str] = []
        for ic in compounddef.findall("innerclass"):
            ic_refid = ic.attrib.get("refid")
            if ic_refid:
                inner_class_refs.append(ic_refid)

        inner_namespace_refs: list[str] = []
        for ins in compounddef.findall("innernamespace"):
            ins_refid = ins.attrib.get("refid")
            if ins_refid:
                inner_namespace_refs.append(ins_refid)

        subgroup_refids: list[str] = []
        for ig in compounddef.findall("innergroup"):
            ig_refid = ig.attrib.get("refid")
            if ig_refid:
                subgroup_refids.append(ig_refid)

        return GroupData(
            id=refid,
            name=name,
            title=title,
            docstring=docstring,
            member_refs=member_refs,
            inner_class_refs=inner_class_refs,
            inner_namespace_refs=inner_namespace_refs,
            subgroup_refids=subgroup_refids,
            extracted_members=extracted_members,
        )
    except Exception:
        logger.error("[cpp-extractor] Failed to extract group %s", refid, exc_info=True)
        return None


def _build_groups(group_data: dict[str, GroupData]) -> list[CppGroupIr]:
    """Build CppGroupIr objects, resolving subgroup references."""
    built: dict[str, CppGroupIr] = {}

    child_refids: set[str] = set()
    for _refid, data in group_data.items():
        for sg_refid in data["subgroup_refids"]:
            child_refids.add(sg_refid)

    def _build_group(refid: str) -> Optional[CppGroupIr]:
        if refid in built:
            return built[refid]
        data = group_data.get(refid)
        if data is None:
            return None
        subgroups: list[CppGroupIr] = []
        for sg_refid in data["subgroup_refids"]:
            sg = _build_group(sg_refid)
            if sg:
                subgroups.append(sg)
        group = CppGroupIr(
            id=data["id"],
            name=data["name"],
            title=data["title"],
            docstring=data["docstring"],
            member_refs=data["member_refs"],
            inner_class_refs=data["inner_class_refs"],
            inner_namespace_refs=data["inner_namespace_refs"],
            subgroups=subgroups,
        )
        built[refid] = group
        return group

    top_level: list[CppGroupIr] = []
    for refid in group_data:
        if refid not in child_refids:
            g = _build_group(refid)
            if g:
                top_level.append(g)
    return top_level
