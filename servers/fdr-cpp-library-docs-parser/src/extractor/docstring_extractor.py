"""Parse Doxygen XML description elements into CppDocstringIr."""

import logging
import re
from typing import TypedDict

from lxml import etree

from src.extractor.ir_builders import (
    bold_seg,
    code_block_doc_block,
    code_ref_seg,
    code_seg,
    emphasis_seg,
    image_block,
    link_seg,
    para_block,
    ref_seg,
    subscript_seg,
    superscript_seg,
    text_seg,
)
from src.generated import (
    CppCodeBlock,
    CppDocBlock,
    CppDocSegment,
    CppDocstringIr,
    CppImageBlock,
    CppListBlock,
    CppParamDoc,
    CppRaisesDoc,
    CppTitledSectionBlock,
    CppVerbatimBlock,
)

logger = logging.getLogger(__name__)

# Regex for Doxygen \c command: \x00c followed by whitespace and a word.
_DOXYGEN_C_CMD_RE = re.compile(r'\x00c\s+(\S+)')

# Regex to detect deprecation from summary text (e.g. "deprecated [since 3.1]").
_SUMMARY_DEPRECATED_RE = re.compile(r'(?i)^deprecated\s*(?:\[(?:since\s+)?([\d.]+)\])?\s*\.?\s*$')

# Module-level aliases dict, set by memory_safe_extractor before extraction begins.
# This avoids threading aliases through every extractor function signature.
_current_aliases: dict[str, str] = {}


def _text_to_segments(text: str) -> list[CppDocSegment]:
    """Convert raw XML text to segments, handling Doxygen null bytes and \\c commands."""
    segments: list[CppDocSegment] = []
    parts = _DOXYGEN_C_CMD_RE.split(text)
    for i, part in enumerate(parts):
        if i % 2 == 1:
            segments.append(code_seg(part))
        else:
            cleaned = part.replace('\x00 ', '').replace('\x00', '')
            if cleaned:
                segments.append(text_seg(cleaned))
    return segments


def set_aliases(aliases: dict[str, str]) -> None:
    """Set the Doxygen ALIASES for the current extraction run."""
    global _current_aliases
    _current_aliases = aliases


def _parse_rst_verbatim(content: str) -> "RstParseResult":
    """Parse RST verbatim content through the RST processor pipeline."""
    from src.extractor.rst_processor import parse_rst_to_ir, preprocess_rst_verbatim
    cleaned = preprocess_rst_verbatim(content, _current_aliases)
    return parse_rst_to_ir(cleaned)

_EXTENSION_LANGUAGE_MAP = {
    ".cpp": "cpp",
    ".c": "c",
    ".h": "cpp",
    ".hpp": "cpp",
    ".py": "python",
    ".java": "java",
    ".js": "javascript",
    ".ts": "typescript",
}

_SIMPLESECT_KIND_MAP = {
    "pre": "preconditions",
    "post": "postconditions",
    "see": "see_also",
    "note": "notes",
    "warning": "warnings",
    "remark": "remarks",
    "return": "returns",
}


class ParaResult(TypedDict):
    """Return type for _process_para."""
    blocks: list[CppDocBlock]
    param_docs: list[CppParamDoc]
    tparam_docs: list[CppParamDoc]
    raises_docs: list[CppRaisesDoc]
    examples: list[CppCodeBlock]
    simplesects: list[tuple[str, list[CppDocSegment]]]
    deprecated: list[CppDocSegment] | None
    since_version: str | None


def extract_docstring(
    brief_elem: etree._Element | None,
    detail_elem: etree._Element | None,
) -> CppDocstringIr | None:
    """Extract a CppDocstringIr from brief and detailed description elements."""
    summary = _extract_summary(brief_elem, detail_elem)
    description: list[CppDocBlock] = []
    params: list[CppParamDoc] = []
    template_params_doc: list[CppParamDoc] = []
    returns: list[CppDocSegment] | None = None
    raises: list[CppRaisesDoc] = []
    examples: list[CppCodeBlock] = []
    notes: list[list[CppDocSegment]] = []
    warnings: list[list[CppDocSegment]] = []
    remarks: list[list[CppDocSegment]] = []
    preconditions: list[list[CppDocSegment]] = []
    postconditions: list[list[CppDocSegment]] = []
    see_also: list[list[CppDocSegment]] = []
    deprecated: list[CppDocSegment] | None = None
    since_version: str | None = None

    if detail_elem is not None:
        for child in detail_elem:
            if child.tag == "para":
                result = _process_para(child)
                if result["blocks"]:
                    description.extend(result["blocks"])
                params.extend(result["param_docs"])
                template_params_doc.extend(result["tparam_docs"])
                raises.extend(result["raises_docs"])
                examples.extend(result["examples"])
                collectors = {
                    "notes": notes, "warnings": warnings, "remarks": remarks,
                    "preconditions": preconditions, "postconditions": postconditions,
                    "see_also": see_also,
                }
                for kind, segments in result["simplesects"]:
                    target = collectors.get(kind)
                    if target is not None:
                        target.append(segments)
                    elif kind == "returns":
                        returns = segments
                if result["deprecated"] is not None:
                    deprecated = result["deprecated"]
                if result.get("since_version"):
                    since_version = result["since_version"]

    if deprecated is None and summary:
        deprecated = _detect_summary_deprecation(summary)

    has_content = any([
        summary, description, params, template_params_doc,
        returns, raises, examples, notes, warnings, remarks,
        preconditions, postconditions, see_also, deprecated, since_version,
    ])
    if not has_content:
        return None

    return CppDocstringIr(
        summary=summary,
        description=description,
        params=params,
        template_params_doc=template_params_doc,
        returns=returns,
        raises=raises,
        examples=examples,
        notes=notes,
        warnings=warnings,
        remarks=remarks,
        preconditions=preconditions,
        postconditions=postconditions,
        see_also=see_also,
        deprecated=deprecated,
        since_version=since_version,
    )


def _extract_summary(
    brief_elem: etree._Element | None,
    detail_elem: etree._Element | None = None,
) -> list[CppDocSegment]:
    """Extract summary segments from <briefdescription>.

    When briefdescription yields no segments, falls back to the first narrative
    <para> in detaileddescription (skipping paras that contain <parameterlist>
    or <simplesect> children).
    """
    segments: list[CppDocSegment] = []
    if brief_elem is not None:
        for para in brief_elem.findall("para"):
            segments.extend(_parse_inline_segments(para))
    if segments:
        return segments
    if detail_elem is not None:
        for para in detail_elem.findall("para"):
            if _is_narrative_para(para):
                segments = _parse_inline_segments(para)
                if segments:
                    return segments
    return []


def _is_narrative_para(para: etree._Element) -> bool:
    """Return True if a <para> element is narrative (no parameterlist/simplesect children)."""
    for child in para:
        if child.tag in ("parameterlist", "simplesect", "verbatim", "programlisting", "itemizedlist", "orderedlist"):
            return False
    return True


def _process_para(para: etree._Element) -> ParaResult:
    """Process a single <para> element, extracting blocks and metadata."""
    result: ParaResult = {
        "blocks": [],
        "param_docs": [],
        "tparam_docs": [],
        "raises_docs": [],
        "examples": [],
        "simplesects": [],
        "deprecated": None,
        "since_version": None,
    }
    inline_segments: list[CppDocSegment] = []
    # Collector for simplesects found nested inside list items (e.g. <simplesect kind="return">
    # inside an <itemizedlist> <listitem> <para>). These are propagated up as if they appeared
    # at the top level of the <para>.
    nested_simplesects: list[tuple[str, list[CppDocSegment]]] = []

    def _flush_inline():
        if inline_segments:
            result["blocks"].append(para_block(list(inline_segments)))
            inline_segments.clear()

    if para.text:
        inline_segments.extend(_text_to_segments(para.text))

    for child in para:
        tag = child.tag
        if tag == "parameterlist":
            _flush_inline()
            kind = child.attrib.get("kind", "")
            if kind == "param":
                result["param_docs"].extend(_parse_parameter_list(child))
            elif kind == "templateparam":
                result["tparam_docs"].extend(_parse_parameter_list(child))
            elif kind == "exception":
                result["raises_docs"].extend(_parse_raises_list(child))
        elif tag == "simplesect":
            _flush_inline()
            kind = child.attrib.get("kind", "")
            if kind == "par":
                block = _parse_titled_section(child)
                result["blocks"].append(block)
            else:
                mapped = _SIMPLESECT_KIND_MAP.get(kind)
                if mapped:
                    segments, sv = _parse_simplesect_content(child)
                    result["simplesects"].append((mapped, segments))
                    if sv:
                        result["since_version"] = sv
        elif tag == "programlisting":
            _flush_inline()
            code_block = _parse_programlisting(child)
            result["examples"].append(code_block)
        elif tag == "verbatim":
            _flush_inline()
            vb = _parse_verbatim(child)
            if vb.format == "rst":
                rst_result = _parse_rst_verbatim(vb.content)
                result["blocks"].extend(rst_result.blocks)
                for note_segs in rst_result.notes:
                    result["simplesects"].append(("notes", note_segs))
                for warn_segs in rst_result.warnings:
                    result["simplesects"].append(("warnings", warn_segs))
                if rst_result.since_version:
                    result["since_version"] = rst_result.since_version
            else:
                result["blocks"].append(CppDocBlock.factory.verbatim(vb))
        elif tag == "itemizedlist":
            _flush_inline()
            lb = _parse_list(child, ordered=False,
                             simplesect_collector=nested_simplesects)
            result["blocks"].append(CppDocBlock.factory.list_(lb))
        elif tag == "orderedlist":
            _flush_inline()
            lb = _parse_list(child, ordered=True,
                             simplesect_collector=nested_simplesects)
            result["blocks"].append(CppDocBlock.factory.list_(lb))
        elif tag == "image":
            _flush_inline()
            ib = _parse_image(child)
            result["blocks"].append(image_block(ib))
        elif tag == "xrefsect":
            _flush_inline()
            dep = _parse_xrefsect(child)
            if dep is not None:
                result["deprecated"] = dep
        elif tag in ("ref", "computeroutput", "bold", "emphasis", "ulink",
                     "subscript", "superscript", "ndash", "mdash"):
            segs = _parse_single_inline(child)
            inline_segments.extend(segs)
        else:
            if child.text:
                inline_segments.extend(_text_to_segments(child.text))
        if child.tail:
            inline_segments.extend(_text_to_segments(child.tail))

    _flush_inline()

    # Propagate simplesects found nested inside list items
    for kind, segments in nested_simplesects:
        result["simplesects"].append((kind, segments))

    return result


def _parse_inline_segments(elem: etree._Element) -> list[CppDocSegment]:
    """Parse all inline segments from an element's mixed content."""
    segments: list[CppDocSegment] = []
    if elem.text:
        segments.extend(_text_to_segments(elem.text))
    for child in elem:
        segs = _parse_single_inline(child)
        segments.extend(segs)
        if child.tail:
            segments.extend(_text_to_segments(child.tail))
    return segments


def _parse_single_inline(child: etree._Element) -> list[CppDocSegment]:
    """Parse a single inline child element into segments."""
    tag = child.tag
    if tag == "ref":
        text = child.text or ""
        refid = child.attrib.get("refid", "")
        kindref = child.attrib.get("kindref", "")
        return [ref_seg(text, refid, kindref)]
    elif tag == "computeroutput":
        return _parse_computeroutput(child)
    elif tag == "bold":
        text = _gather_text(child)
        return [bold_seg(text)]
    elif tag == "emphasis":
        text = _gather_text(child)
        return [emphasis_seg(text)]
    elif tag == "ulink":
        text = _gather_text(child)
        url = child.attrib.get("url", "")
        return [link_seg(text, url)]
    elif tag == "subscript":
        text = _gather_text(child)
        return [subscript_seg(text)]
    elif tag == "superscript":
        text = _gather_text(child)
        return [superscript_seg(text)]
    elif tag == "ndash":
        return [text_seg("\u2013")]
    elif tag == "mdash":
        return [text_seg("\u2014")]
    elif tag == "verbatim":
        vb = _parse_verbatim(child)
        if vb.format == "rst":
            rst_result = _parse_rst_verbatim(vb.content)
            return _segments_from_blocks(rst_result.blocks)
        else:
            return [text_seg(vb.content)]
    else:
        text = _gather_text(child)
        if text:
            return [text_seg(text)]
        return []


def _parse_computeroutput(elem: etree._Element) -> list[CppDocSegment]:
    """Parse <computeroutput> which may contain <ref> children."""
    segments: list[CppDocSegment] = []
    has_ref = False
    for child in elem:
        if child.tag == "ref":
            has_ref = True
            break

    if not has_ref:
        text = _gather_text(elem)
        return [code_seg(text)]

    if elem.text:
        segments.append(code_seg(elem.text.replace('\x00 ', '').replace('\x00', '')))
    for child in elem:
        if child.tag == "ref":
            code_text = child.text or ""
            refid = child.attrib.get("refid", "")
            kindref = child.attrib.get("kindref", "")
            segments.append(code_ref_seg(code_text, refid, kindref))
        else:
            text = _gather_text(child)
            if text:
                segments.append(code_seg(text))
        if child.tail:
            segments.append(code_seg(child.tail.replace('\x00 ', '').replace('\x00', '')))
    return segments


def _extract_param_name(pname_elem: etree._Element) -> str:
    """Extract parameter name, falling back to <ref> child text if needed."""
    name = pname_elem.text or ""
    if not name:
        ref_child = pname_elem.find("ref")
        if ref_child is not None:
            name = ref_child.text or ""
    return name


def _parse_parameter_list(plist: etree._Element) -> list[CppParamDoc]:
    """Parse a <parameterlist> into CppParamDoc items."""
    docs: list[CppParamDoc] = []
    for item in plist.findall("parameteritem"):
        namelist = item.find("parameternamelist")
        desc_elem = item.find("parameterdescription")
        if namelist is None:
            continue
        pname_elem = namelist.find("parametername")
        if pname_elem is None:
            continue
        name = _extract_param_name(pname_elem)
        direction = pname_elem.attrib.get("direction")
        description: list[CppDocSegment] = []
        if desc_elem is not None:
            for para in desc_elem.findall("para"):
                description.extend(_parse_inline_segments(para))
        doc = CppParamDoc(
            name=name,
            description=description,
            direction=direction,
        )
        docs.append(doc)
    return docs


def _parse_raises_list(plist: etree._Element) -> list[CppRaisesDoc]:
    """Parse a <parameterlist kind="exception"> into CppRaisesDoc items."""
    docs: list[CppRaisesDoc] = []
    for item in plist.findall("parameteritem"):
        namelist = item.find("parameternamelist")
        desc_elem = item.find("parameterdescription")
        if namelist is None:
            continue
        pname_elem = namelist.find("parametername")
        if pname_elem is None:
            continue
        exception = _extract_param_name(pname_elem)
        description: list[CppDocSegment] = []
        if desc_elem is not None:
            for para in desc_elem.findall("para"):
                description.extend(_parse_inline_segments(para))
        docs.append(CppRaisesDoc(exception=exception, description=description))
    return docs


def _parse_simplesect_content(
    elem: etree._Element,
) -> tuple[list[CppDocSegment], str | None]:
    """Parse the content of a <simplesect> into segments.

    Handles both inline elements and <programlisting> children within <para>.
    Also handles <itemizedlist>/<orderedlist> by flattening list items into
    inline segments (preserving refs).
    Also handles <verbatim> children with RST format, extracting since_version.
    Since the return type is list[CppDocSegment], programlisting content is
    captured as a CppDocCodeSegment (preserving the code text).

    Returns:
        A tuple of (segments, since_version). since_version is set if a
        <verbatim> block with RST .. versionadded:: directive is found.
    """
    segments: list[CppDocSegment] = []
    since_version: str | None = None
    for para in elem.findall("para"):
        if para.text:
            segments.extend(_text_to_segments(para.text))
        for child in para:
            if child.tag == "programlisting":
                code_block = _parse_programlisting(child)
                # Intentionally discard code_block.language: the return type is
                # list[CppDocSegment] which doesn't support CppCodeBlock, so we
                # flatten the code text into a CppDocCodeSegment instead.
                segments.append(code_seg(code_block.code))
            elif child.tag == "verbatim":
                vb = _parse_verbatim(child)
                if vb.format == "rst":
                    rst_result = _parse_rst_verbatim(vb.content)
                    segments.extend(_segments_from_blocks(rst_result.blocks))
                    if rst_result.since_version:
                        since_version = rst_result.since_version
                else:
                    segments.append(text_seg(vb.content))
            elif child.tag in ("itemizedlist", "orderedlist"):
                # Flatten list items into inline segments, preserving refs.
                # The return type is list[CppDocSegment] so we can't produce
                # CppListBlock here; instead walk each <listitem><para> and
                # extract inline segments.
                # Insert a space separator between items so adjacent text/ref
                # segments from different items don't merge (e.g. "device" +
                # "device_ref" -> "devicedevice_ref" without the separator).
                first_item = True
                for listitem in child.findall("listitem"):
                    item_segs: list[CppDocSegment] = []
                    for li_para in listitem.findall("para"):
                        item_segs.extend(_parse_inline_segments(li_para))
                    if item_segs:
                        if not first_item and segments:
                            segments.append(text_seg(" "))
                        segments.extend(item_segs)
                        first_item = False
            else:
                segs = _parse_single_inline(child)
                segments.extend(segs)
            if child.tail:
                segments.extend(_text_to_segments(child.tail))
    return segments, since_version


def _parse_titled_section(elem: etree._Element) -> CppDocBlock:
    """Parse <simplesect kind="par"> into a TitledSectionBlock.

    Handles both inline content and block-level <programlisting> children
    within each <para> element, similar to how _process_para handles mixed content.
    """
    title_elem = elem.find("title")
    title = title_elem.text if title_elem is not None and title_elem.text else None
    blocks: list[CppDocBlock] = []
    inline_segments: list[CppDocSegment] = []

    def _flush():
        if inline_segments:
            blocks.append(para_block(list(inline_segments)))
            inline_segments.clear()

    for para in elem.findall("para"):
        inline_segments.clear()
        if para.text:
            inline_segments.extend(_text_to_segments(para.text))
        for child in para:
            if child.tag == "programlisting":
                _flush()
                code_block = _parse_programlisting(child)
                blocks.append(code_block_doc_block(code_block))
            elif child.tag == "itemizedlist":
                _flush()
                lb = _parse_list(child, ordered=False)
                blocks.append(CppDocBlock.factory.list_(lb))
            elif child.tag == "orderedlist":
                _flush()
                lb = _parse_list(child, ordered=True)
                blocks.append(CppDocBlock.factory.list_(lb))
            else:
                segs = _parse_single_inline(child)
                inline_segments.extend(segs)
            if child.tail:
                inline_segments.extend(_text_to_segments(child.tail))
        _flush()
    return CppDocBlock.factory.titled_section(
        CppTitledSectionBlock(title=title, blocks=blocks)
    )


def _parse_programlisting(elem: etree._Element) -> CppCodeBlock:
    """Parse <programlisting> into a CppCodeBlock."""
    filename = elem.attrib.get("filename", "")
    language = None
    for ext, lang in _EXTENSION_LANGUAGE_MAP.items():
        if filename.endswith(ext):
            language = lang
            break
    lines: list[str] = []
    for codeline in elem.findall("codeline"):
        line_parts: list[str] = []
        for highlight in codeline.findall("highlight"):
            if highlight.text:
                line_parts.append(highlight.text)
            for sp in highlight:
                if sp.tag == "sp":
                    line_parts.append(" ")
                elif sp.tag == "ref":
                    line_parts.append(sp.text or "")
                elif sp.text:
                    line_parts.append(sp.text)
                if sp.tail:
                    line_parts.append(sp.tail)
        lines.append("".join(line_parts))
    code = "\n".join(lines)
    return CppCodeBlock(type="codeBlock", code=code, language=language)


def _parse_verbatim(elem: etree._Element) -> CppVerbatimBlock:
    """Parse <verbatim> into a CppVerbatimBlock."""
    content = elem.text or ""
    fmt = None
    if content.startswith("embed:rst"):
        fmt = "rst"
    return CppVerbatimBlock(content=content, format=fmt)


def _process_list_para_child(
    child: etree._Element,
    item_blocks: list[CppDocBlock],
    simplesect_collector: list[tuple[str, list[CppDocSegment]]] | None,
) -> None:
    """Process a single child element inside a list item's <para>.

    Handles nested lists, simplesects, and titled sections, appending
    results to item_blocks or simplesect_collector as appropriate.
    """
    if child.tag == "itemizedlist":
        lb = _parse_list(child, ordered=False,
                         simplesect_collector=simplesect_collector)
        item_blocks.append(CppDocBlock.factory.list_(lb))
    elif child.tag == "orderedlist":
        lb = _parse_list(child, ordered=True,
                         simplesect_collector=simplesect_collector)
        item_blocks.append(CppDocBlock.factory.list_(lb))
    elif child.tag == "simplesect" and simplesect_collector is not None:
        kind = child.attrib.get("kind", "")
        if kind == "par":
            block = _parse_titled_section(child)
            item_blocks.append(block)
        else:
            mapped = _SIMPLESECT_KIND_MAP.get(kind)
            if mapped:
                # _sv (since_version) intentionally discarded; version metadata
                # inside list-nested simplesects is not propagated
                segs, _sv = _parse_simplesect_content(child)
                simplesect_collector.append((mapped, segs))
            else:
                logger.debug("Unmapped simplesect kind '%s' in list item, skipping", kind)


def _parse_list(
    elem: etree._Element,
    ordered: bool,
    simplesect_collector: list[tuple[str, list[CppDocSegment]]] | None = None,
) -> CppListBlock:
    """Parse <itemizedlist> or <orderedlist> into a CppListBlock.

    Args:
        elem: The list XML element.
        ordered: True for <orderedlist>, False for <itemizedlist>.
        simplesect_collector: If provided, any <simplesect> elements found nested
            inside list items will be appended as (kind, segments) tuples.
            This allows callers (e.g. _process_para) to propagate return sections,
            notes, etc. that Doxygen sometimes nests inside list items.
    """
    items: list[list[CppDocBlock]] = []
    for listitem in elem.findall("listitem"):
        item_blocks: list[CppDocBlock] = []
        for para in listitem.findall("para"):
            segments = _parse_inline_segments(para)
            if segments:
                item_blocks.append(para_block(segments))
            for child in para:
                _process_list_para_child(child, item_blocks, simplesect_collector)
        items.append(item_blocks)
    return CppListBlock(ordered=ordered, items=items)


def _parse_image(elem: etree._Element) -> CppImageBlock:
    """Parse <image> into a CppImageBlock."""
    path = elem.attrib.get("name", "")
    caption = elem.text if elem.text and elem.text.strip() else None
    is_inline = elem.attrib.get("inline", "") == "yes"
    return CppImageBlock(path=path, caption=caption, is_inline=is_inline)


def _parse_xrefsect(elem: etree._Element) -> list[CppDocSegment] | None:
    """Parse <xrefsect> for deprecation notices."""
    title_elem = elem.find("xreftitle")
    if title_elem is None or title_elem.text != "Deprecated":
        return None
    desc_elem = elem.find("xrefdescription")
    if desc_elem is None:
        return []
    segments: list[CppDocSegment] = []
    for para in desc_elem.findall("para"):
        segments.extend(_parse_inline_segments(para))
    return segments


def _detect_summary_deprecation(
    summary: list[CppDocSegment],
) -> list[CppDocSegment] | None:
    """Detect deprecation from summary text like 'deprecated [since 3.1]'."""
    summary_text = "".join(
        seg.dict().get("text", "") + seg.dict().get("code", "")
        for seg in summary
    )
    m = _SUMMARY_DEPRECATED_RE.match(summary_text.strip())
    if not m:
        return None
    version = m.group(1)
    if version:
        return [text_seg(f"Deprecated since {version}.")]
    return [text_seg("Deprecated.")]


def _segments_from_blocks(blocks: list[CppDocBlock]) -> list[CppDocSegment]:
    """Flatten paragraph blocks into a segment list for inline contexts."""
    segments: list[CppDocSegment] = []
    for block in blocks:
        variant = block.get_as_union()
        if variant.type == "paragraph":
            segments.extend(variant.segments)
    return segments


def _gather_text(elem: etree._Element) -> str:
    """Gather all text content from an element."""
    parts: list[str] = []
    if elem.text:
        parts.append(elem.text)
    for child in elem:
        parts.append(_gather_text(child))
        if child.tail:
            parts.append(child.tail)
    result = "".join(parts)
    return result.replace('\x00 ', '').replace('\x00', '')


