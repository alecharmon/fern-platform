"""Tests for class_extractor module."""

from pathlib import Path

from lxml import etree

from src.extractor.class_extractor import extract_class
from src.generated import CppClassIr

FIXTURES = Path(__file__).parent / "fixtures"


def _load_compounddef(filename):
    tree = etree.parse(str(FIXTURES / filename))
    return tree.getroot().find("compounddef")


def test_full_class():
    cd = _load_compounddef("class_full.xml")
    result = extract_class(cd)
    assert result is not None

    kwargs, inner_class_refids = result

    assert kwargs["name"] == "MyClass"
    assert kwargs["path"] == "my_ns::MyClass"
    assert kwargs["kind"] == "class"
    assert kwargs["is_abstract"] is False
    assert kwargs["is_final"] is True
    assert kwargs["include_header"] == "my_class.h"

    # Template params
    assert len(kwargs["template_params"]) == 1
    assert kwargs["template_params"][0].name == "T"

    # Base classes
    assert len(kwargs["base_classes"]) == 1
    assert kwargs["base_classes"][0].name == "my_ns::BaseClass"
    assert kwargs["base_classes"][0].access == "public"
    assert kwargs["base_classes"][0].is_virtual is False

    # Derived classes
    assert len(kwargs["derived_classes"]) == 1
    assert kwargs["derived_classes"][0].name == "my_ns::DerivedClass"

    # Methods
    assert len(kwargs["methods"]) >= 1
    method_names = [m.name for m in kwargs["methods"]]
    assert "doStuff" in method_names

    # Static methods
    assert len(kwargs["static_methods"]) == 1
    assert kwargs["static_methods"][0].name == "create"

    # Friend functions - should include operator== but NOT FriendClass
    assert len(kwargs["friend_functions"]) == 1
    assert kwargs["friend_functions"][0].name == "operator=="

    # Typedefs
    assert len(kwargs["typedefs"]) == 1
    assert kwargs["typedefs"][0].name == "value_type"

    # Variables
    assert len(kwargs["member_variables"]) == 1
    assert kwargs["member_variables"][0].name == "count"

    # Enums
    assert len(kwargs["enums"]) == 1
    assert kwargs["enums"][0].name == "Status"

    # Inner class refids
    assert "classmy__ns_1_1MyClass_1_1Inner" in inner_class_refids

    # Related member refs
    assert "related001" in kwargs["related_member_refs"]

    # Section labels (keyed by memberdef id, not qualifiedname)
    assert "method003" in kwargs["section_labels"]
    assert kwargs["section_labels"]["method003"] == "Advanced Methods"

    # User-defined method is in methods list
    assert "advancedOp" in method_names

    # Docstring
    assert kwargs["docstring"] is not None

    # Build the CppClassIr (without inner_classes for this test)
    kwargs["inner_classes"] = []
    class_ir = CppClassIr(**kwargs)
    assert class_ir.name == "MyClass"
    assert class_ir.kind == "class"


def test_struct_kind():
    xml = """
    <doxygen>
      <compounddef id="structFoo" kind="struct" language="C++" abstract="no" final="no">
        <compoundname>Foo</compoundname>
        <sectiondef kind="public-attrib">
          <memberdef kind="variable" id="v1" static="no" constexpr="no" mutable="no">
            <type>int</type>
            <definition>int Foo::x</definition>
            <name>x</name>
            <qualifiedname>Foo::x</qualifiedname>
            <briefdescription></briefdescription>
            <detaileddescription></detaileddescription>
          </memberdef>
        </sectiondef>
        <briefdescription></briefdescription>
        <detaileddescription></detaileddescription>
      </compounddef>
    </doxygen>
    """
    tree = etree.fromstring(xml)
    cd = tree.find("compounddef")
    result = extract_class(cd)
    assert result is not None
    kwargs, _ = result
    assert kwargs["kind"] == "struct"
    assert kwargs["name"] == "Foo"


def test_friend_type_filtering():
    """Friend type declarations (struct/class) should be filtered out."""
    xml = """
    <doxygen>
      <compounddef id="classTest" kind="class" language="C++" abstract="no" final="no">
        <compoundname>Test</compoundname>
        <sectiondef kind="friend">
          <memberdef kind="friend" id="f1" static="no" const="no" constexpr="no" volatile="no" inline="no" explicit="no" noexcept="no" nodiscard="no" virt="non-virtual" prot="public">
            <type>struct</type>
            <definition></definition>
            <argsstring></argsstring>
            <name>MyFriendStruct</name>
            <qualifiedname>Test::MyFriendStruct</qualifiedname>
            <briefdescription></briefdescription>
            <detaileddescription></detaileddescription>
          </memberdef>
          <memberdef kind="friend" id="f2" static="no" const="no" constexpr="no" volatile="no" inline="no" explicit="no" noexcept="no" nodiscard="no" virt="non-virtual" prot="public">
            <type>friend void</type>
            <definition>friend void swap</definition>
            <argsstring>(Test &amp;a, Test &amp;b)</argsstring>
            <name>swap</name>
            <qualifiedname>Test::swap</qualifiedname>
            <param><type>Test &amp;</type><declname>a</declname></param>
            <param><type>Test &amp;</type><declname>b</declname></param>
            <briefdescription><para>Swap two Test objects.</para></briefdescription>
            <detaileddescription></detaileddescription>
          </memberdef>
        </sectiondef>
        <briefdescription></briefdescription>
        <detaileddescription></detaileddescription>
      </compounddef>
    </doxygen>
    """
    tree = etree.fromstring(xml)
    cd = tree.find("compounddef")
    result = extract_class(cd)
    assert result is not None
    kwargs, _ = result
    # MyFriendStruct should be filtered (type="struct"), swap should remain
    assert len(kwargs["friend_functions"]) == 1
    assert kwargs["friend_functions"][0].name == "swap"


def test_undocumented_friend_functions_excluded():
    """Undocumented friend functions should be excluded from the IR."""
    xml = """
    <doxygen>
      <compounddef id="classPtr" kind="class" language="C++" abstract="no" final="no">
        <compoundname>thrust::pointer</compoundname>
        <sectiondef kind="friend">
          <memberdef kind="friend" id="f_documented" static="no" const="no" constexpr="no" volatile="no" inline="no" explicit="no" noexcept="no" nodiscard="no" virt="non-virtual" prot="public">
            <type>friend bool</type>
            <definition>friend bool operator==</definition>
            <argsstring>(const pointer &amp;a, const pointer &amp;b)</argsstring>
            <name>operator==</name>
            <qualifiedname>thrust::pointer::operator==</qualifiedname>
            <param><type>const pointer &amp;</type><declname>a</declname></param>
            <param><type>const pointer &amp;</type><declname>b</declname></param>
            <briefdescription><para>Equality comparison for pointers.</para></briefdescription>
            <detaileddescription></detaileddescription>
          </memberdef>
          <memberdef kind="friend" id="f_undoc1" static="no" const="no" constexpr="no" volatile="no" inline="no" explicit="no" noexcept="no" nodiscard="no" virt="non-virtual" prot="public">
            <type>friend bool</type>
            <definition>friend bool operator!=</definition>
            <argsstring>(const pointer &amp;a, const pointer &amp;b)</argsstring>
            <name>operator!=</name>
            <qualifiedname>thrust::pointer::operator!=</qualifiedname>
            <param><type>const pointer &amp;</type><declname>a</declname></param>
            <param><type>const pointer &amp;</type><declname>b</declname></param>
            <briefdescription></briefdescription>
            <detaileddescription></detaileddescription>
          </memberdef>
          <memberdef kind="friend" id="f_undoc2" static="no" const="no" constexpr="no" volatile="no" inline="no" explicit="no" noexcept="no" nodiscard="no" virt="non-virtual" prot="public">
            <type>friend bool</type>
            <definition>friend bool operator&lt;</definition>
            <argsstring>(const pointer &amp;a, const pointer &amp;b)</argsstring>
            <name>operator&lt;</name>
            <qualifiedname>thrust::pointer::operator&lt;</qualifiedname>
            <param><type>const pointer &amp;</type><declname>a</declname></param>
            <param><type>const pointer &amp;</type><declname>b</declname></param>
            <briefdescription></briefdescription>
            <detaileddescription></detaileddescription>
          </memberdef>
          <memberdef kind="friend" id="f_detail_only" static="no" const="no" constexpr="no" volatile="no" inline="no" explicit="no" noexcept="no" nodiscard="no" virt="non-virtual" prot="public">
            <type>friend void</type>
            <definition>friend void swap</definition>
            <argsstring>(pointer &amp;a, pointer &amp;b)</argsstring>
            <name>swap</name>
            <qualifiedname>thrust::pointer::swap</qualifiedname>
            <param><type>pointer &amp;</type><declname>a</declname></param>
            <param><type>pointer &amp;</type><declname>b</declname></param>
            <briefdescription></briefdescription>
            <detaileddescription><para>Swap two pointers.</para></detaileddescription>
          </memberdef>
        </sectiondef>
        <briefdescription></briefdescription>
        <detaileddescription></detaileddescription>
      </compounddef>
    </doxygen>
    """
    tree = etree.fromstring(xml)
    cd = tree.find("compounddef")
    result = extract_class(cd)
    assert result is not None
    kwargs, _ = result

    # Only documented friends should be included:
    # - operator== has briefdescription -> included
    # - operator!= has no docs -> excluded
    # - operator< has no docs -> excluded
    # - swap has detaileddescription -> included
    assert len(kwargs["friend_functions"]) == 2
    friend_names = [f.name for f in kwargs["friend_functions"]]
    assert "operator==" in friend_names
    assert "swap" in friend_names
    assert "operator!=" not in friend_names
    assert "operator<" not in friend_names


def test_section_labels_overloaded_functions():
    """Overloaded functions in different user-defined sections must each get their own
    section_labels entry. When using qualifiedname as key, the second section
    overwrites the first because they share the same qualifiedname. Using memberdef id
    as key avoids this collision."""
    cd = _load_compounddef("class_overloaded_section_labels.xml")
    result = extract_class(cd)
    assert result is not None

    kwargs, _ = result

    # All 4 ExclusiveSum overloads should be extracted as methods
    assert len(kwargs["methods"]) == 4

    section_labels = kwargs["section_labels"]

    # There are 4 memberdefs across 2 different sections, so we must have 4 entries
    assert len(section_labels) == 4, (
        f"Expected 4 section_labels entries (one per memberdef), got {len(section_labels)}. "
        f"Keys: {list(section_labels.keys())}"
    )

    # Verify that both section header values are present (not just the last one)
    label_values = set(section_labels.values())
    assert "Exclusive prefix sum operations" in label_values, (
        f"Missing 'Exclusive prefix sum operations' in section_labels values: {label_values}"
    )
    assert "Exclusive prefix sum operations (multiple data per thread)" in label_values, (
        f"Missing 'Exclusive prefix sum operations (multiple data per thread)' in section_labels values: {label_values}"
    )

    # Specifically: memberdef ids from section 1 should map to "Exclusive prefix sum operations"
    assert section_labels.get("excl_sum_1") == "Exclusive prefix sum operations"
    assert section_labels.get("excl_sum_2") == "Exclusive prefix sum operations"

    # And memberdef ids from section 2 should map to the multi-data header
    assert section_labels.get("excl_sum_multi_1") == "Exclusive prefix sum operations (multiple data per thread)"
    assert section_labels.get("excl_sum_multi_2") == "Exclusive prefix sum operations (multiple data per thread)"
