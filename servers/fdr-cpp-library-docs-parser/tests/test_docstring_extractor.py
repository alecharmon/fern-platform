"""Tests for docstring_extractor module."""

from pathlib import Path

from lxml import etree

from src.extractor.docstring_extractor import extract_docstring

FIXTURES = Path(__file__).parent / "fixtures"


def _load_memberdef(filename):
    tree = etree.parse(str(FIXTURES / filename))
    return tree.getroot()


def test_full_docstring():
    md = _load_memberdef("docstring_full.xml")
    brief = md.find("briefdescription")
    detail = md.find("detaileddescription")
    ds = extract_docstring(brief, detail)
    assert ds is not None

    # Summary
    assert len(ds.summary) > 0

    # Description blocks
    assert len(ds.description) > 0

    # Params
    assert len(ds.params) == 1
    assert ds.params[0].name == "input"
    assert ds.params[0].direction == "in"
    assert len(ds.params[0].description) > 0

    # Template params
    assert len(ds.template_params_doc) == 1
    assert ds.template_params_doc[0].name == "T"

    # Returns
    assert ds.returns is not None
    assert len(ds.returns) > 0

    # Notes
    assert len(ds.notes) == 1

    # Warnings
    assert len(ds.warnings) == 1

    # Remarks
    assert len(ds.remarks) == 1

    # Preconditions
    assert len(ds.preconditions) == 1

    # Postconditions
    assert len(ds.postconditions) == 1

    # See also
    assert len(ds.see_also) == 1

    # Raises
    assert len(ds.raises) == 1
    assert ds.raises[0].exception == "std::runtime_error"

    # Deprecated
    assert ds.deprecated is not None
    assert len(ds.deprecated) > 0

    # Examples (programlisting)
    assert len(ds.examples) == 1
    assert ds.examples[0].language == "cpp"


def test_ndash_mdash():
    md = _load_memberdef("docstring_full.xml")
    detail = md.find("detaileddescription")
    ds = extract_docstring(None, detail)
    assert ds is not None
    # Find the block with ndash/mdash
    found_endash = False
    found_emdash = False
    for block in ds.description:
        d = block.dict()
        # Check segments for the special characters
        for seg in d.get("segments", []):
            text = seg.get("text", "")
            if "\u2013" in text:
                found_endash = True
            if "\u2014" in text:
                found_emdash = True
    assert found_endash, "en-dash not found"
    assert found_emdash, "em-dash not found"


def test_code_ref_segment():
    md = _load_memberdef("docstring_full.xml")
    detail = md.find("detaileddescription")
    ds = extract_docstring(None, detail)
    assert ds is not None
    found_code_ref = False
    for block in ds.description:
        d = block.dict()
        for seg in d.get("segments", []):
            if seg.get("type") == "codeRef":
                found_code_ref = True
                assert seg.get("code") == "device_ref"
                assert seg.get("refid") == "classDevice"
    assert found_code_ref, "codeRef segment not found"


def test_verbatim_block():
    md = _load_memberdef("docstring_full.xml")
    detail = md.find("detaileddescription")
    ds = extract_docstring(None, detail)
    assert ds is not None
    found_verbatim = False
    for block in ds.description:
        d = block.dict()
        if d.get("type") == "verbatim":
            found_verbatim = True
            assert d.get("format") == "rst"
    assert found_verbatim, "verbatim block not found"


def test_list_block():
    md = _load_memberdef("docstring_full.xml")
    detail = md.find("detaileddescription")
    ds = extract_docstring(None, detail)
    assert ds is not None
    found_list = False
    for block in ds.description:
        d = block.dict()
        if d.get("type") == "list":
            found_list = True
            assert d.get("ordered") is False
            assert len(d.get("items", [])) == 2
    assert found_list, "list block not found"


def test_image_block():
    md = _load_memberdef("docstring_full.xml")
    detail = md.find("detaileddescription")
    ds = extract_docstring(None, detail)
    assert ds is not None
    found_image = False
    for block in ds.description:
        d = block.dict()
        if d.get("type") == "image":
            found_image = True
            assert d.get("path") == "diagram.png"
            assert d.get("isInline") is True
    assert found_image, "image block not found"


def test_titled_section():
    md = _load_memberdef("docstring_full.xml")
    detail = md.find("detaileddescription")
    ds = extract_docstring(None, detail)
    assert ds is not None
    found_titled = False
    for block in ds.description:
        d = block.dict()
        if d.get("type") == "titledSection":
            found_titled = True
            assert d.get("title") == "Snippet"
    assert found_titled, "titled section not found"


def test_emphasis_and_link():
    md = _load_memberdef("docstring_full.xml")
    detail = md.find("detaileddescription")
    ds = extract_docstring(None, detail)
    assert ds is not None
    found_emphasis = False
    found_link = False
    for block in ds.description:
        d = block.dict()
        for seg in d.get("segments", []):
            if seg.get("type") == "emphasis":
                found_emphasis = True
                assert seg.get("text") == "italic text"
            if seg.get("type") == "link":
                found_link = True
                assert seg.get("url") == "https://example.com"
    assert found_emphasis, "emphasis segment not found"
    assert found_link, "link segment not found"


def test_subscript_superscript():
    md = _load_memberdef("docstring_full.xml")
    detail = md.find("detaileddescription")
    ds = extract_docstring(None, detail)
    assert ds is not None
    found_sub = False
    found_sup = False
    for block in ds.description:
        d = block.dict()
        for seg in d.get("segments", []):
            if seg.get("type") == "subscript":
                found_sub = True
                assert seg.get("text") == "sub"
            if seg.get("type") == "superscript":
                found_sup = True
                assert seg.get("text") == "sup"
    assert found_sub, "subscript not found"
    assert found_sup, "superscript not found"


def test_empty_docstring():
    brief = etree.fromstring("<briefdescription></briefdescription>")
    detail = etree.fromstring("<detaileddescription></detaileddescription>")
    ds = extract_docstring(brief, detail)
    assert ds is None


def test_none_elements():
    ds = extract_docstring(None, None)
    assert ds is None


def test_xrefsect_deprecated_standalone():
    """Verify that <xrefsect> deprecation is captured when it appears as the
    only meaningful content inside <detaileddescription>, as commonly seen for
    group-defined typedefs in Doxygen XML (e.g. thrust::tuple_element)."""
    xml = """<memberdef>
  <briefdescription><para>Old type alias.</para></briefdescription>
  <detaileddescription>
    <para>
      <xrefsect id="deprecated_1_deprecated000099">
        <xreftitle>Deprecated</xreftitle>
        <xrefdescription><para>Use new_type instead.</para></xrefdescription>
      </xrefsect>
    </para>
  </detaileddescription>
</memberdef>"""
    root = etree.fromstring(xml)
    brief = root.find("briefdescription")
    detail = root.find("detaileddescription")
    ds = extract_docstring(brief, detail)
    assert ds is not None
    assert ds.deprecated is not None
    assert len(ds.deprecated) > 0
    dep_text = "".join(
        seg.dict().get("text", "") for seg in ds.deprecated
    )
    assert "new_type" in dep_text


def test_xrefsect_non_deprecated_ignored():
    """Verify that <xrefsect> with a title other than 'Deprecated' is not
    captured in the deprecated field."""
    xml = """<memberdef>
  <briefdescription></briefdescription>
  <detaileddescription>
    <para>
      <xrefsect id="some_other_1_ref000001">
        <xreftitle>Bug</xreftitle>
        <xrefdescription><para>Known issue.</para></xrefdescription>
      </xrefsect>
    </para>
  </detaileddescription>
</memberdef>"""
    root = etree.fromstring(xml)
    brief = root.find("briefdescription")
    detail = root.find("detaileddescription")
    ds = extract_docstring(brief, detail)
    # The xrefsect with non-Deprecated title should not populate deprecated
    if ds is not None:
        assert ds.deprecated is None


def test_programlisting_inside_titled_section():
    """Verify that <programlisting> inside <simplesect kind='par'> (titled section)
    is captured as a CppCodeBlock within the titled section's blocks, not silently dropped."""
    md = _load_memberdef("docstring_programlisting_in_simplesect.xml")
    brief = md.find("briefdescription")
    detail = md.find("detaileddescription")
    ds = extract_docstring(brief, detail)
    assert ds is not None

    # Find the titled section with title "Example"
    titled_sections = []
    for block in ds.description:
        d = block.dict()
        if d.get("type") == "titledSection":
            titled_sections.append(d)

    assert len(titled_sections) >= 1, "Expected at least one titled section"

    # The "Example" titled section should contain a code block
    example_section = next(
        (ts for ts in titled_sections if ts.get("title") == "Example"), None
    )
    assert example_section is not None, "Titled section with title 'Example' not found"

    # Check that the titled section's blocks contain a code block
    inner_blocks = example_section.get("blocks", [])
    code_blocks = [b for b in inner_blocks if b.get("type") == "codeBlock"]
    assert len(code_blocks) == 1, (
        f"Expected 1 code block in 'Example' titled section, got {len(code_blocks)}. "
        f"Blocks found: {[b.get('type') for b in inner_blocks]}"
    )
    assert "ThreadLoad" in code_blocks[0].get("code", ""), (
        "Code block should contain 'ThreadLoad'"
    )
    assert code_blocks[0].get("language") == "cpp", (
        "Code block language should be 'cpp'"
    )


def test_programlisting_inside_simplesect_note():
    """Verify that <programlisting> inside <simplesect kind='note'> is captured.
    The notes field contains list[list[CppDocSegment]], so we need a way to
    include code blocks. Since simplesect content historically returns segments,
    we verify the code content is not silently dropped."""
    md = _load_memberdef("docstring_programlisting_in_simplesect.xml")
    brief = md.find("briefdescription")
    detail = md.find("detaileddescription")
    ds = extract_docstring(brief, detail)
    assert ds is not None

    # There should be at least 1 note
    assert len(ds.notes) >= 1, "Expected at least one note"

    # The note should contain some reference to the code.
    # Since _parse_simplesect_content returns segments, the code block text
    # should appear somewhere in the note's content (as a code segment or text).
    note_segments = ds.notes[0]
    all_text = ""
    for seg in note_segments:
        d = seg.dict()
        all_text += d.get("text", "") + d.get("code", "")
    assert "assert(x > 0)" in all_text, (
        f"Note should contain code text 'assert(x > 0)', got segments: "
        f"{[s.dict() for s in note_segments]}"
    )

    # Verify the code content is carried as a 'code' type segment, not plain text
    code_segs = [s for s in note_segments if s.get_as_union().type == "code"]
    assert len(code_segs) >= 1, (
        "Expected at least one 'code' type segment in the note, "
        f"got types: {[s.get_as_union().type for s in note_segments]}"
    )


def test_programlisting_inside_titled_section_mixed():
    """Verify that a titled section with mixed text paragraphs and programlisting
    captures both text and code blocks correctly."""
    md = _load_memberdef("docstring_programlisting_in_simplesect.xml")
    brief = md.find("briefdescription")
    detail = md.find("detaileddescription")
    ds = extract_docstring(brief, detail)
    assert ds is not None

    # Find the titled section with title "Usage"
    titled_sections = []
    for block in ds.description:
        d = block.dict()
        if d.get("type") == "titledSection":
            titled_sections.append(d)

    usage_section = next(
        (ts for ts in titled_sections if ts.get("title") == "Usage"), None
    )
    assert usage_section is not None, "Titled section with title 'Usage' not found"

    inner_blocks = usage_section.get("blocks", [])

    # Should have text paragraphs AND a code block
    paragraph_blocks = [b for b in inner_blocks if b.get("type") == "paragraph"]
    code_blocks = [b for b in inner_blocks if b.get("type") == "codeBlock"]

    assert len(paragraph_blocks) >= 1, (
        f"Expected at least 1 paragraph block, got {len(paragraph_blocks)}"
    )
    assert len(code_blocks) == 1, (
        f"Expected 1 code block in 'Usage' titled section, got {len(code_blocks)}. "
        f"Blocks found: {[b.get('type') for b in inner_blocks]}"
    )
    assert "compute(42)" in code_blocks[0].get("code", ""), (
        "Code block should contain 'compute(42)'"
    )
    assert code_blocks[0].get("language") == "python", (
        "Code block language should be 'python'"
    )


def test_titled_section_with_list_preserves_refs():
    """Verify that <itemizedlist> inside a titled section (<simplesect kind='par'>)
    preserves ref segments. Extracted from CUB ArgIndexInputIterator and
    DeviceMergeSort which have <ref> elements inside list items within titled
    sections. Before the fix, _parse_titled_section treated <itemizedlist> as
    inline via _parse_single_inline, losing all refs."""
    md = _load_memberdef("docstring_titled_section_with_list.xml")
    brief = md.find("briefdescription")
    detail = md.find("detaileddescription")
    ds = extract_docstring(brief, detail)
    assert ds is not None

    # Find the titled section with title "Overview"
    titled_sections = []
    for block in ds.description:
        d = block.dict()
        if d.get("type") == "titledSection":
            titled_sections.append(d)

    assert len(titled_sections) >= 1, "Expected at least one titled section"

    overview = next(
        (ts for ts in titled_sections if ts.get("title") == "Overview"), None
    )
    assert overview is not None, "Titled section with title 'Overview' not found"

    # The titled section should contain a list block
    inner_blocks = overview.get("blocks", [])
    list_blocks = [b for b in inner_blocks if b.get("type") == "list"]
    assert len(list_blocks) == 1, (
        f"Expected 1 list block in 'Overview' titled section, got {len(list_blocks)}. "
        f"Blocks found: {[b.get('type') for b in inner_blocks]}"
    )

    # The list should have 2 items
    items = list_blocks[0].get("items", [])
    assert len(items) == 2, f"Expected 2 list items, got {len(items)}"

    # Collect all ref segments from the entire titled section
    all_refids = set()

    def collect_refs(obj):
        if isinstance(obj, dict):
            if obj.get("type") == "codeRef" and "refid" in obj:
                all_refids.add(obj["refid"])
            elif obj.get("type") == "ref" and "refid" in obj:
                all_refids.add(obj["refid"])
            for v in obj.values():
                collect_refs(v)
        elif isinstance(obj, list):
            for item in obj:
                collect_refs(item)

    collect_refs(overview)

    # The codeRef for "itr" should be present
    assert "classFoo_1a50e9f7c54e94ff617bf6f85e70f63d73" in all_refids, (
        f"Expected codeRef refid for 'itr' not found. Found refids: {all_refids}"
    )
    # The ref for "DeviceRadixSort" should be present
    assert "structDeviceRadixSort" in all_refids, (
        f"Expected ref refid for 'DeviceRadixSort' not found. Found refids: {all_refids}"
    )


def test_simplesect_return_nested_in_list_item():
    """Verify that <simplesect kind='return'> nested inside a list item's <para>
    is properly extracted as the docstring's returns field. Extracted from CUB
    cub::MergePath where Doxygen nests the return section inside a bibliography
    list item. Before the fix, the return section was lost because _parse_list
    did not handle <simplesect> children."""
    md = _load_memberdef("docstring_simplesect_in_list.xml")
    brief = md.find("briefdescription")
    detail = md.find("detaileddescription")
    ds = extract_docstring(brief, detail)
    assert ds is not None

    # The return section should be extracted
    assert ds.returns is not None, "Expected returns to be present"
    assert len(ds.returns) > 0, "Expected returns to have segments"

    # Verify the returns content mentions "first sequence"
    returns_text = ""
    for seg in ds.returns:
        d = seg.dict()
        returns_text += d.get("text", "") + d.get("code", "")
    assert "first sequence" in returns_text, (
        f"Expected 'first sequence' in returns text, got: {returns_text}"
    )


def test_parametername_with_ref_child():
    """Verify that <parametername> containing a <ref> child extracts the param
    name from the ref text. Extracted from Thrust zip_iterator::zip_iterator
    where Doxygen wraps the parametername in a <ref> element:
    <parametername><ref refid="...">iterator_tuple</ref></parametername>.
    Before the fix, _parse_parameter_list only checked pname_elem.text which
    is None when the text is inside a <ref> child, resulting in empty name."""
    md = _load_memberdef("docstring_parametername_with_ref.xml")
    brief = md.find("briefdescription")
    detail = md.find("detaileddescription")
    ds = extract_docstring(brief, detail)
    assert ds is not None

    # Should have 2 params
    assert len(ds.params) == 2, f"Expected 2 params, got {len(ds.params)}"

    # First param name should be "iterator_tuple" (from ref child), not ""
    assert ds.params[0].name == "iterator_tuple", (
        f"Expected first param name 'iterator_tuple', got '{ds.params[0].name}'"
    )

    # Second param should still work normally
    assert ds.params[1].name == "count", (
        f"Expected second param name 'count', got '{ds.params[1].name}'"
    )


def test_see_also_list_with_ref_produces_ref_segment():
    """Verify that <ref> inside an <itemizedlist> within <simplesect kind='see'>
    produces a 'ref' segment (not 'codeRef').

    Extracted from libcudacxx namespacecuda.xml where cuda::devices has a see_also
    section containing an itemizedlist with <ref refid="classcuda_1_1device__ref">.
    The same refid also appears inside <computeroutput> in the description (codeRef).
    The validator expects both 'ref' and 'codeRef' for the same refid, but the parser
    was only producing 'codeRef' because _parse_simplesect_content didn't handle
    <itemizedlist> children and fell through to _gather_text, losing the ref."""
    md = _load_memberdef("docstring_see_also_list_with_ref.xml")
    brief = md.find("briefdescription")
    detail = md.find("detaileddescription")
    ds = extract_docstring(brief, detail)
    assert ds is not None

    # The see_also field should be populated
    assert len(ds.see_also) >= 1, "Expected at least one see_also entry"

    # Collect all segment types and refids from see_also
    see_also_segments = ds.see_also[0]
    ref_segments = []
    for seg in see_also_segments:
        d = seg.dict()
        if d.get("type") == "ref" and d.get("refid"):
            ref_segments.append(d)

    # There should be a "ref" segment (not "codeRef") for classcuda_1_1device__ref
    assert any(
        s["refid"] == "classcuda_1_1device__ref" and s["type"] == "ref"
        for s in ref_segments
    ), (
        f"Expected a 'ref' segment with refid='classcuda_1_1device__ref' in see_also. "
        f"Got segments: {[s.dict() for s in see_also_segments]}"
    )

    # Verify that list items are separated by a space when flattened.
    # Without the fix, "device" and "device_ref" merge into "devicedevice_ref".
    all_text = ""
    for seg in see_also_segments:
        d = seg.dict()
        all_text += d.get("text", "") + d.get("code", "")
    assert "device device_ref" in all_text or "device\n" in all_text, (
        f"Expected space or newline between list items 'device' and 'device_ref', "
        f"got concatenated text: {all_text!r}"
    )

    # Also verify that the description has a codeRef for the same refid
    # (from the <computeroutput> context)
    found_code_ref = False
    for block in ds.description:
        d = block.dict()
        for seg in d.get("segments", []):
            if (seg.get("type") == "codeRef"
                    and seg.get("refid") == "classcuda_1_1device__ref"):
                found_code_ref = True
    assert found_code_ref, (
        "Expected a 'codeRef' segment with refid='classcuda_1_1device__ref' in description"
    )


def test_see_also_list_items_have_space_separator():
    """Verify that when an <itemizedlist> in a <simplesect kind='see'> is flattened
    into inline segments, adjacent list items are separated by a space.

    Without the fix, the parser produces segments like text("device") + ref("device_ref")
    which concatenate to "devicedevice_ref" instead of "device device_ref"."""
    xml = """<memberdef>
  <briefdescription><para>Some brief.</para></briefdescription>
  <detaileddescription>
    <para><simplesect kind="see"><para><itemizedlist>
      <listitem><para>alpha</para>
      </listitem><listitem><para>beta</para>
      </listitem><listitem><para><ref refid="some_ref" kindref="compound">gamma</ref></para>
      </listitem></itemizedlist>
    </para>
    </simplesect>
    </para>
  </detaileddescription>
</memberdef>"""
    root = etree.fromstring(xml)
    brief = root.find("briefdescription")
    detail = root.find("detaileddescription")
    ds = extract_docstring(brief, detail)
    assert ds is not None
    assert len(ds.see_also) >= 1

    # Concatenate all text from the see_also segments
    see_also_segments = ds.see_also[0]
    all_text = ""
    for seg in see_also_segments:
        d = seg.dict()
        all_text += d.get("text", "") + d.get("code", "")

    # Each list item should be separated by at least a space
    assert "alpha" in all_text
    assert "beta" in all_text
    assert "gamma" in all_text

    # The critical check: items must NOT merge
    assert "alphabeta" not in all_text, (
        f"List items 'alpha' and 'beta' merged without separator: {all_text!r}"
    )
    assert "betagamma" not in all_text, (
        f"List items 'beta' and 'gamma' merged without separator: {all_text!r}"
    )
