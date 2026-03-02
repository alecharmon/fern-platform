"""Parse Doxygen XML description elements into CppDocstringIr."""

import logging
from typing import Optional, TypedDict

from lxml import etree

from src.generated import (
    CppCodeBlock,
    CppDocBlock,
    CppDocBoldSegment,
    CppDocCodeRefSegment,
    CppDocCodeSegment,
    CppDocEmphasisSegment,
    CppDocLinkSegment,
    CppDocRefSegment,
    CppDocSegment,
    CppDocSubscriptSegment,
    CppDocSuperscriptSegment,
    CppDocTextSegment,
    CppDocstringIr,
    CppImageBlock,
    CppListBlock,
    CppParagraphBlock,
    CppParamDoc,
    CppRaisesDoc,
    CppTitledSectionBlock,
    CppVerbatimBlock,
)

logger = logging.getLogger(__name__)

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
    deprecated: Optional[list[CppDocSegment]]


def _text_seg(text: str) -> CppDocSegment:
    return CppDocSegment.factory.text(CppDocTextSegment(text=text))


def _para_block(segments: list[CppDocSegment]) -> CppDocBlock:
    return CppDocBlock.factory.paragraph(CppParagraphBlock(segments=segments))


def _image_block(value: CppImageBlock) -> CppDocBlock:
    """Construct CppDocBlock.image manually to work around SDK factory alias bug.

    The generated factory method CppDocBlock.factory.image() uses
    value.dict(exclude_unset=True) which returns Python field names (e.g. is_inline),
    but _CppDocBlock.Image expects the Pydantic alias (e.g. isInline) in v2 mode.
    This causes a ValidationError for the is_inline field. Constructing the Image
    variant directly with explicit field values bypasses this issue.
    """
    from src.generated.core.pydantic_utilities import IS_PYDANTIC_V2
    from src.generated.types.cpp_doc_block import _CppDocBlock
    img = _CppDocBlock.Image(
        path=value.path,
        caption=value.caption,
        is_inline=value.is_inline,
        type="image",
    )
    if IS_PYDANTIC_V2:
        return CppDocBlock(root=img)  # type: ignore
    else:
        return CppDocBlock(__root__=img)  # type: ignore


def _code_block_doc_block(value: CppCodeBlock) -> CppDocBlock:
    """Construct CppDocBlock.code_block manually to work around SDK factory bug.

    The generated factory method CppDocBlock.factory.code_block() calls
    value.dict(exclude_unset=True) which includes the 'type' field from
    CppCodeBlock, then also passes type="codeBlock" as a keyword argument.
    This causes a TypeError due to duplicate 'type' keyword. Constructing
    the CodeBlock variant directly with explicit field values bypasses this.
    """
    from src.generated.core.pydantic_utilities import IS_PYDANTIC_V2
    from src.generated.types.cpp_doc_block import _CppDocBlock
    cb = _CppDocBlock.CodeBlock(
        code=value.code,
        language=value.language,
        type="codeBlock",
    )
    if IS_PYDANTIC_V2:
        return CppDocBlock(root=cb)  # type: ignore
    else:
        return CppDocBlock(__root__=cb)  # type: ignore


def extract_docstring(
    brief_elem: Optional[etree._Element],
    detail_elem: Optional[etree._Element],
) -> Optional[CppDocstringIr]:
    """Extract a CppDocstringIr from brief and detailed description elements."""
    summary = _extract_summary(brief_elem)
    description: list[CppDocBlock] = []
    params: list[CppParamDoc] = []
    template_params_doc: list[CppParamDoc] = []
    returns: Optional[list[CppDocSegment]] = None
    raises: list[CppRaisesDoc] = []
    examples: list[CppCodeBlock] = []
    notes: list[list[CppDocSegment]] = []
    warnings: list[list[CppDocSegment]] = []
    remarks: list[list[CppDocSegment]] = []
    preconditions: list[list[CppDocSegment]] = []
    postconditions: list[list[CppDocSegment]] = []
    see_also: list[list[CppDocSegment]] = []
    deprecated: Optional[list[CppDocSegment]] = None

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
                for kind, segments in result["simplesects"]:
                    if kind == "returns":
                        returns = segments
                    elif kind == "notes":
                        notes.append(segments)
                    elif kind == "warnings":
                        warnings.append(segments)
                    elif kind == "remarks":
                        remarks.append(segments)
                    elif kind == "preconditions":
                        preconditions.append(segments)
                    elif kind == "postconditions":
                        postconditions.append(segments)
                    elif kind == "see_also":
                        see_also.append(segments)
                if result["deprecated"] is not None:
                    deprecated = result["deprecated"]

    if (
        not summary
        and not description
        and not params
        and not template_params_doc
        and returns is None
        and not raises
        and not examples
        and not notes
        and not warnings
        and not remarks
        and not preconditions
        and not postconditions
        and not see_also
        and deprecated is None
    ):
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
    )


def _extract_summary(brief_elem: Optional[etree._Element]) -> list[CppDocSegment]:
    """Extract summary segments from <briefdescription>."""
    if brief_elem is None:
        return []
    segments: list[CppDocSegment] = []
    for para in brief_elem.findall("para"):
        segments.extend(_parse_inline_segments(para))
    return segments


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
    }
    inline_segments: list[CppDocSegment] = []
    # Collector for simplesects found nested inside list items (e.g. <simplesect kind="return">
    # inside an <itemizedlist> <listitem> <para>). These are propagated up as if they appeared
    # at the top level of the <para>.
    nested_simplesects: list[tuple[str, list[CppDocSegment]]] = []

    def _flush_inline():
        if inline_segments:
            result["blocks"].append(_para_block(list(inline_segments)))
            inline_segments.clear()

    if para.text:
        inline_segments.append(_text_seg(para.text))

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
                    segments = _parse_simplesect_content(child)
                    result["simplesects"].append((mapped, segments))
        elif tag == "programlisting":
            _flush_inline()
            code_block = _parse_programlisting(child)
            result["examples"].append(code_block)
        elif tag == "verbatim":
            _flush_inline()
            vb = _parse_verbatim(child)
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
            result["blocks"].append(_image_block(ib))
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
                inline_segments.append(_text_seg(child.text))
        if child.tail:
            inline_segments.append(_text_seg(child.tail))

    _flush_inline()

    # Propagate simplesects found nested inside list items
    for kind, segments in nested_simplesects:
        result["simplesects"].append((kind, segments))

    return result


def _parse_inline_segments(elem: etree._Element) -> list[CppDocSegment]:
    """Parse all inline segments from an element's mixed content."""
    segments: list[CppDocSegment] = []
    if elem.text:
        segments.append(_text_seg(elem.text))
    for child in elem:
        segs = _parse_single_inline(child)
        segments.extend(segs)
        if child.tail:
            segments.append(_text_seg(child.tail))
    return segments


def _parse_single_inline(child: etree._Element) -> list[CppDocSegment]:
    """Parse a single inline child element into segments."""
    tag = child.tag
    if tag == "ref":
        text = child.text or ""
        refid = child.attrib.get("refid", "")
        kindref = child.attrib.get("kindref", "")
        return [CppDocSegment.factory.ref(CppDocRefSegment(text=text, refid=refid, kindref=kindref))]
    elif tag == "computeroutput":
        return _parse_computeroutput(child)
    elif tag == "bold":
        text = _gather_text(child)
        return [CppDocSegment.factory.bold(CppDocBoldSegment(text=text))]
    elif tag == "emphasis":
        text = _gather_text(child)
        return [CppDocSegment.factory.emphasis(CppDocEmphasisSegment(text=text))]
    elif tag == "ulink":
        text = _gather_text(child)
        url = child.attrib.get("url", "")
        return [CppDocSegment.factory.link(CppDocLinkSegment(text=text, url=url))]
    elif tag == "subscript":
        text = _gather_text(child)
        return [CppDocSegment.factory.subscript(CppDocSubscriptSegment(text=text))]
    elif tag == "superscript":
        text = _gather_text(child)
        return [CppDocSegment.factory.superscript(CppDocSuperscriptSegment(text=text))]
    elif tag == "ndash":
        return [_text_seg("\u2013")]
    elif tag == "mdash":
        return [_text_seg("\u2014")]
    else:
        text = _gather_text(child)
        if text:
            return [_text_seg(text)]
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
        return [CppDocSegment.factory.code(CppDocCodeSegment(code=text))]

    if elem.text:
        segments.append(CppDocSegment.factory.code(CppDocCodeSegment(code=elem.text)))
    for child in elem:
        if child.tag == "ref":
            code_text = child.text or ""
            refid = child.attrib.get("refid", "")
            kindref = child.attrib.get("kindref", "")
            segments.append(
                CppDocSegment.factory.code_ref(
                    CppDocCodeRefSegment(code=code_text, refid=refid, kindref=kindref)
                )
            )
        else:
            text = _gather_text(child)
            if text:
                segments.append(CppDocSegment.factory.code(CppDocCodeSegment(code=text)))
        if child.tail:
            segments.append(CppDocSegment.factory.code(CppDocCodeSegment(code=child.tail)))
    return segments


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
        # Doxygen sometimes wraps the parameter name in a <ref> child:
        # <parametername><ref refid="...">name</ref></parametername>
        # In that case, pname_elem.text is None so fall back to the ref's text.
        name = pname_elem.text or ""
        if not name:
            ref_child = pname_elem.find("ref")
            if ref_child is not None:
                name = ref_child.text or ""
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
        exception = pname_elem.text or ""
        if not exception:
            ref_child = pname_elem.find("ref")
            if ref_child is not None:
                exception = ref_child.text or ""
        description: list[CppDocSegment] = []
        if desc_elem is not None:
            for para in desc_elem.findall("para"):
                description.extend(_parse_inline_segments(para))
        docs.append(CppRaisesDoc(exception=exception, description=description))
    return docs


def _parse_simplesect_content(elem: etree._Element) -> list[CppDocSegment]:
    """Parse the content of a <simplesect> into segments.

    Handles both inline elements and <programlisting> children within <para>.
    Also handles <itemizedlist>/<orderedlist> by flattening list items into
    inline segments (preserving refs).
    Since the return type is list[CppDocSegment], programlisting content is
    captured as a CppDocCodeSegment (preserving the code text).
    """
    segments: list[CppDocSegment] = []
    for para in elem.findall("para"):
        if para.text:
            segments.append(_text_seg(para.text))
        for child in para:
            if child.tag == "programlisting":
                code_block = _parse_programlisting(child)
                # Intentionally discard code_block.language: the return type is
                # list[CppDocSegment] which doesn't support CppCodeBlock, so we
                # flatten the code text into a CppDocCodeSegment instead.
                segments.append(
                    CppDocSegment.factory.code(CppDocCodeSegment(code=code_block.code))
                )
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
                            segments.append(_text_seg(" "))
                        segments.extend(item_segs)
                        first_item = False
            else:
                segs = _parse_single_inline(child)
                segments.extend(segs)
            if child.tail:
                segments.append(_text_seg(child.tail))
    return segments


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
            blocks.append(_para_block(list(inline_segments)))
            inline_segments.clear()

    for para in elem.findall("para"):
        inline_segments.clear()
        if para.text:
            inline_segments.append(_text_seg(para.text))
        for child in para:
            if child.tag == "programlisting":
                _flush()
                code_block = _parse_programlisting(child)
                blocks.append(_code_block_doc_block(code_block))
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
                inline_segments.append(_text_seg(child.tail))
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


def _parse_list(
    elem: etree._Element,
    ordered: bool,
    simplesect_collector: Optional[list[tuple[str, list[CppDocSegment]]]] = None,
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
                item_blocks.append(_para_block(segments))
            for child in para:
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
                            segs = _parse_simplesect_content(child)
                            simplesect_collector.append((mapped, segs))
                        else:
                            logger.debug("Unmapped simplesect kind '%s' in list item, skipping", kind)
        items.append(item_blocks)
    return CppListBlock(ordered=ordered, items=items)


def _parse_image(elem: etree._Element) -> CppImageBlock:
    """Parse <image> into a CppImageBlock."""
    path = elem.attrib.get("name", "")
    caption = elem.text if elem.text and elem.text.strip() else None
    is_inline = elem.attrib.get("inline", "") == "yes"
    return CppImageBlock(path=path, caption=caption, is_inline=is_inline)


def _parse_xrefsect(elem: etree._Element) -> Optional[list[CppDocSegment]]:
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


def _gather_text(elem: etree._Element) -> str:
    """Gather all text content from an element."""
    parts: list[str] = []
    if elem.text:
        parts.append(elem.text)
    for child in elem:
        parts.append(_gather_text(child))
        if child.tail:
            parts.append(child.tail)
    return "".join(parts)


