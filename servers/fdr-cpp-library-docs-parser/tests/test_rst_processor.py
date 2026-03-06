"""Tests for rst_processor module."""

from src.extractor.rst_processor import (
    _expand_aliases,
    _strip_comment_prefixes,
    parse_rst_to_ir,
    preprocess_rst_verbatim,
)


def _find_blocks_by_type(result, type_name):
    """Return all blocks in *result* whose dict ``type`` matches *type_name*."""
    return [b for b in result.blocks if b.dict().get("type") == type_name]


# ---------------------------------------------------------------------------
# _strip_comment_prefixes
# ---------------------------------------------------------------------------

def test_strip_bang_prefix():
    lines = ["//! First line", "//! Second line", "//!Third (no space)"]
    result = _strip_comment_prefixes(lines)
    assert result == ["First line", "Second line", "Third (no space)"]


def test_strip_star_prefix():
    lines = [" * First line", " * Second line", " *Third (no space)"]
    result = _strip_comment_prefixes(lines)
    assert result == ["First line", "Second line", "Third (no space)"]


def test_strip_no_prefix():
    lines = ["Plain line 1", "Plain line 2"]
    result = _strip_comment_prefixes(lines)
    assert result == ["Plain line 1", "Plain line 2"]


def test_strip_empty_lines():
    result = _strip_comment_prefixes([])
    assert result == []


# ---------------------------------------------------------------------------
# _expand_aliases
# ---------------------------------------------------------------------------

def test_expand_simple_alias():
    aliases = {"rowmajor": "Row-major order"}
    result = _expand_aliases("Uses @rowmajor layout.", aliases)
    assert result == "Uses Row-major order layout."


def test_expand_parameterized_alias():
    aliases = {"blockcollective{1}": "Every thread in the block uses \\1"}
    result = _expand_aliases("@blockcollective{ScanOp} here.", aliases)
    assert result == "Every thread in the block uses ScanOp here."


def test_expand_parameterized_call_with_plain_alias_drops_arg():
    aliases = {"myalias": "plain expansion"}
    result = _expand_aliases("@myalias{arg} text.", aliases)
    assert result == "plain expansion text."


def test_expand_unknown_alias_unchanged():
    result = _expand_aliases("@unknown macro.", {})
    assert result == "@unknown macro."


def test_expand_unknown_parameterized_unchanged():
    result = _expand_aliases("@unknown{arg} text.", {})
    assert result == "@unknown{arg} text."


# ---------------------------------------------------------------------------
# preprocess_rst_verbatim (full pipeline)
# ---------------------------------------------------------------------------

def test_preprocess_full_pipeline():
    content = (
        "embed:rst:leading-asterisk\n"
        " * @rowmajor layout is used.\n"
        " *\n"
        " * Second paragraph."
    )
    aliases = {"rowmajor": "Row-major"}
    result = preprocess_rst_verbatim(content, aliases)
    assert "Row-major layout is used." in result
    assert "Second paragraph." in result
    assert "embed:rst" not in result
    assert "*" not in result.splitlines()[0]


def test_preprocess_bang_prefix():
    content = (
        "embed:rst\n"
        "//! Some RST content.\n"
        "//! More content."
    )
    result = preprocess_rst_verbatim(content, {})
    assert "Some RST content." in result
    assert "More content." in result
    assert "//!" not in result


# ---------------------------------------------------------------------------
# parse_rst_to_ir: versionadded
# ---------------------------------------------------------------------------

def test_versionadded():
    rst = ".. versionadded:: 2.2.0\n"
    result = parse_rst_to_ir(rst)
    assert result.since_version == "2.2.0"
    assert len(result.notes) == 1
    note_text = result.notes[0][0].dict().get("text", "")
    assert note_text == "Added in version 2.2.0"


def test_versionadded_with_content_body():
    rst = (
        ".. versionadded:: 2.2.0\n"
        "   First appears in CUDA 12.3.\n"
    )
    result = parse_rst_to_ir(rst)
    assert result.since_version == "2.2.0"
    assert len(result.notes) >= 1
    note_text = result.notes[0][0].dict().get("text", "")
    assert "Added in version 2.2.0" in note_text
    assert "First appears in CUDA 12.3." in note_text


# ---------------------------------------------------------------------------
# parse_rst_to_ir: code-block
# ---------------------------------------------------------------------------

def test_code_block():
    rst = (
        ".. code-block:: c++\n"
        "\n"
        "   int x = 42;\n"
        "   return x;\n"
    )
    result = parse_rst_to_ir(rst)
    code_blocks = _find_blocks_by_type(result, "codeBlock")
    assert len(code_blocks) == 1
    cb = code_blocks[0].dict()
    assert cb.get("language") == "cpp"
    assert "int x = 42;" in cb.get("code", "")


# ---------------------------------------------------------------------------
# parse_rst_to_ir: inline roles
# ---------------------------------------------------------------------------

def test_inline_roles():
    rst = (
        "See :ref:`some_label` and :cpp:class:`MyClass` and :sub:`subscript` text.\n"
    )
    result = parse_rst_to_ir(rst)
    assert len(result.blocks) >= 1
    d = result.blocks[0].dict()
    segments = d.get("segments", [])
    types = [s.get("type") for s in segments]
    assert "ref" in types
    assert "code" in types
    assert "subscript" in types


# ---------------------------------------------------------------------------
# parse_rst_to_ir: note / warning
# ---------------------------------------------------------------------------

def test_note_directive():
    rst = (
        ".. note::\n"
        "\n"
        "   This is a note.\n"
    )
    result = parse_rst_to_ir(rst)
    assert len(result.notes) == 1
    note_text = "".join(
        s.dict().get("text", "") for s in result.notes[0]
    )
    assert "This is a note." in note_text


def test_warning_directive():
    rst = (
        ".. warning::\n"
        "\n"
        "   This is a warning.\n"
    )
    result = parse_rst_to_ir(rst)
    assert len(result.warnings) == 1
    warn_text = "".join(
        s.dict().get("text", "") for s in result.warnings[0]
    )
    assert "This is a warning." in warn_text


def test_warning_inside_section():
    rst = (
        "Details\n"
        "-------\n"
        "\n"
        ".. warning::\n"
        "\n"
        "   This is dangerous.\n"
    )
    result = parse_rst_to_ir(rst)
    assert len(result.warnings) == 1
    warn_text = "".join(
        s.dict().get("text", "") for s in result.warnings[0]
    )
    assert "This is dangerous." in warn_text


def test_note_inside_section():
    rst = (
        "Details\n"
        "-------\n"
        "\n"
        ".. note::\n"
        "\n"
        "   Keep this in mind.\n"
    )
    result = parse_rst_to_ir(rst)
    assert len(result.notes) == 1
    note_text = "".join(
        s.dict().get("text", "") for s in result.notes[0]
    )
    assert "Keep this in mind." in note_text


# ---------------------------------------------------------------------------
# parse_rst_to_ir: bullet list
# ---------------------------------------------------------------------------

def test_bullet_list():
    rst = (
        "- Item one\n"
        "- Item two\n"
        "- Item three\n"
    )
    result = parse_rst_to_ir(rst)
    list_blocks = _find_blocks_by_type(result, "list")
    assert len(list_blocks) >= 1
    d = list_blocks[0].dict()
    assert d.get("ordered") is False
    assert len(d.get("items", [])) == 3


# ---------------------------------------------------------------------------
# parse_rst_to_ir: full mixed content
# ---------------------------------------------------------------------------

def test_full_mixed_content():
    rst = (
        "This is a paragraph with **bold** and *emphasis*.\n"
        "\n"
        ".. versionadded:: 1.0.0\n"
        "\n"
        ".. code-block:: c++\n"
        "\n"
        "   auto x = foo();\n"
        "\n"
        ".. note::\n"
        "\n"
        "   Remember this.\n"
        "\n"
        ".. warning::\n"
        "\n"
        "   Be careful.\n"
        "\n"
        "- First item\n"
        "- Second item\n"
    )
    result = parse_rst_to_ir(rst)

    # Paragraph with bold and emphasis
    para_blocks = _find_blocks_by_type(result, "paragraph")
    assert len(para_blocks) >= 1
    first_para = para_blocks[0].dict()
    seg_types = [s.get("type") for s in first_para.get("segments", [])]
    assert "bold" in seg_types
    assert "emphasis" in seg_types

    # versionadded
    assert result.since_version == "1.0.0"

    code_blocks = _find_blocks_by_type(result, "codeBlock")
    assert len(code_blocks) >= 1
    assert any("auto x = foo();" in b.dict().get("code", "") for b in code_blocks)

    # notes: one from versionadded + one from the note directive
    assert len(result.notes) == 2

    # warning
    assert len(result.warnings) == 1

    # list
    list_blocks = _find_blocks_by_type(result, "list")
    assert len(list_blocks) == 1
    assert len(list_blocks[0].dict().get("items", [])) == 2


# ---------------------------------------------------------------------------
# parse_rst_to_ir: code block inside block_quote
# ---------------------------------------------------------------------------

def test_code_block_inside_block_quote():
    rst = (
        "Details\n"
        "-------\n"
        "\n"
        "   .. code-block:: c++\n"
        "\n"
        "      int y = 10;\n"
    )
    result = parse_rst_to_ir(rst)
    # The code block should be inside the titled section's blocks
    assert len(result.blocks) >= 1
    section = result.blocks[0].dict()
    assert section.get("type") == "titledSection"
    inner_blocks = section.get("blocks", [])
    code_blocks = [b for b in inner_blocks if b.get("type") == "codeBlock"]
    assert len(code_blocks) == 1
    assert "int y = 10;" in code_blocks[0].get("code", "")


# ---------------------------------------------------------------------------
# parse_rst_to_ir: null byte stripping from RST backslash escapes
# ---------------------------------------------------------------------------

def test_null_bytes_stripped_from_backslash_escapes():
    """RST backslash escapes (e.g. ``\\ ``) become \\x00 markers internally
    in docutils.  These must be stripped before emitting segments."""
    # The ``\ `` between *i* and :sup:`th` produces a null byte in docutils
    rst = "The *i*\\ :sup:`th` element\n"
    result = parse_rst_to_ir(rst)
    assert len(result.blocks) >= 1
    segments = result.blocks[0].dict().get("segments", [])

    # Verify no segment text contains null bytes
    for seg in segments:
        text = seg.get("text", "")
        assert "\x00" not in text, f"Null byte found in segment: {seg}"

    # Verify there are no empty-string-only text segments between emphasis and superscript
    seg_types = [s.get("type") for s in segments]
    assert "emphasis" in seg_types
    assert "superscript" in seg_types


def test_null_bytes_stripped_from_emphasis_and_bold():
    """Null bytes inside emphasis/bold nodes are stripped."""
    # ``\\ `` after bold produces null byte
    rst = "**bold**\\ *emph* text\n"
    result = parse_rst_to_ir(rst)
    assert len(result.blocks) >= 1
    segments = result.blocks[0].dict().get("segments", [])

    for seg in segments:
        text = seg.get("text", "")
        assert "\x00" not in text, f"Null byte found in segment: {seg}"

    seg_types = [s.get("type") for s in segments]
    assert "bold" in seg_types
    assert "emphasis" in seg_types


