"""End-to-end tests for memory_safe_extractor module."""

from pathlib import Path

from src.extractor.memory_safe_extractor import _merge_unique_members, extract_library_docs
from src.generated import IrMetadata
from src.generated.types.cpp_function_ir import CppFunctionIr

FIXTURES = Path(__file__).parent / "fixtures"


def test_end_to_end():
    """Full IR construction from a fixture XML directory."""
    xml_dir = FIXTURES / "e2e_xml"
    metadata = IrMetadata(
        package_name="TestLib",
        language="CPP",
        source_url="https://github.com/test/lib",
    )
    ir = extract_library_docs(xml_dir, metadata)

    # Metadata
    assert ir.metadata.package_name == "TestLib"
    assert ir.metadata.language == "CPP"

    # Root namespace
    assert ir.root_namespace.name == ""
    assert ir.root_namespace.path == ""
    assert len(ir.root_namespace.namespaces) == 1

    # my_ns namespace
    ns = ir.root_namespace.namespaces[0]
    assert ns.name == "my_ns"
    assert ns.path == "my_ns"
    assert len(ns.functions) == 1
    assert ns.functions[0].name == "free_func"
    assert len(ns.enums) == 1
    assert ns.enums[0].name == "MyEnum"

    # my_ns::Widget class
    assert len(ns.classes) == 1
    widget = ns.classes[0]
    assert widget.name == "Widget"
    assert widget.path == "my_ns::Widget"
    assert widget.include_header == "widget.h"
    assert len(widget.methods) == 1
    assert widget.methods[0].name == "run"

    # Group-only typedef with xrefsect deprecation is merged into namespace
    deprecated_td = [td for td in ns.typedefs if td.name == "old_container"]
    assert len(deprecated_td) == 1, (
        "Group-only typedef 'old_container' should be merged into my_ns namespace"
    )
    td = deprecated_td[0]
    assert td.path == "my_ns::old_container"
    assert td.docstring is not None, "Typedef should have a docstring"
    assert td.docstring.deprecated is not None, (
        "<xrefsect> deprecation from group XML should be captured"
    )
    # Verify the deprecation message content
    dep_dict = [seg.dict() for seg in td.docstring.deprecated]
    dep_text = "".join(seg.get("text", "") for seg in dep_dict)
    assert "std::vector" in dep_text, (
        f"Deprecation message should mention 'std::vector', got: {dep_text}"
    )

    # Groups
    assert len(ir.groups) == 1
    group = ir.groups[0]
    assert group.name == "algorithms"
    assert group.title == "Algorithms"
    assert len(group.member_refs) >= 1
    assert len(group.inner_class_refs) == 1
    assert "classmy__ns_1_1Widget" in group.inner_class_refs


def test_missing_index_raises():
    """Missing index.xml should raise FileNotFoundError."""
    import pytest
    metadata = IrMetadata(package_name="X", language="CPP")
    with pytest.raises(FileNotFoundError):
        extract_library_docs(Path("/nonexistent"), metadata)


def test_ir_serialization():
    """Ensure the IR can be serialized to dict (Pydantic validation)."""
    xml_dir = FIXTURES / "e2e_xml"
    metadata = IrMetadata(
        package_name="TestLib",
        language="CPP",
    )
    ir = extract_library_docs(xml_dir, metadata)
    d = ir.dict()
    assert "metadata" in d
    assert "rootNamespace" in d or "root_namespace" in d
    assert "groups" in d


def _make_function(name: str, path: str, signature: str) -> CppFunctionIr:
    return CppFunctionIr(
        name=name,
        path=path,
        signature=signature,
        template_params=[],
        parameters=[],
        is_static=False,
        is_const=False,
        is_constexpr=False,
        is_volatile=False,
        is_inline=False,
        is_explicit=False,
        is_noexcept=False,
        is_no_discard=False,
        is_deleted=False,
        virtuality="non-virtual",
    )


def test_merge_unique_members_keeps_function_overloads():
    """Two functions with the same path but different signatures are both kept."""
    ns_kwargs: dict = {}
    overload_a = _make_function("operator==", "random::operator==", "bool operator==(const A &)")
    overload_b = _make_function("operator==", "random::operator==", "bool operator==(const B &)")
    _merge_unique_members(ns_kwargs, [overload_a, overload_b], "functions")
    assert len(ns_kwargs["functions"]) == 2
