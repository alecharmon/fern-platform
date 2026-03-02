"""Tests for namespace_extractor module."""

from pathlib import Path

from lxml import etree

from src.extractor.namespace_extractor import extract_namespace

FIXTURES = Path(__file__).parent / "fixtures"


def _load_compounddef(filename):
    tree = etree.parse(str(FIXTURES / filename))
    return tree.getroot().find("compounddef")


def test_full_namespace():
    cd = _load_compounddef("namespace_full.xml")
    result = extract_namespace(cd)
    assert result is not None

    kwargs, inner_ns_refids, inner_class_refids = result

    assert kwargs["name"] == "my_ns"
    assert kwargs["path"] == "my_ns"

    # Functions
    assert len(kwargs["functions"]) == 1
    assert kwargs["functions"][0].name == "free_func"

    # Enums
    assert len(kwargs["enums"]) == 1
    assert kwargs["enums"][0].name == "MyEnum"

    # Typedefs
    assert len(kwargs["typedefs"]) == 1
    assert kwargs["typedefs"][0].name == "IntAlias"

    # Concepts (detected from constexpr bool variable with template params)
    assert len(kwargs["concepts"]) == 1
    assert kwargs["concepts"][0].name == "is_resource"
    assert kwargs["concepts"][0].path == "my_ns::is_resource"
    assert len(kwargs["concepts"][0].template_params) == 1

    # Variables (non-concept)
    assert len(kwargs["variables"]) == 1
    assert kwargs["variables"][0].name == "VERSION"
    assert kwargs["variables"][0].is_static is True
    assert kwargs["variables"][0].is_constexpr is True
    assert kwargs["variables"][0].initializer == "= 42"

    # Inner namespace refids
    assert "namespacemy__ns_1_1detail" in inner_ns_refids

    # Inner class refids
    assert "classmy__ns_1_1MyClass" in inner_class_refids

    # Docstring
    assert kwargs["docstring"] is not None


def test_concept_detection():
    """Concept detection: constexpr=yes, type=bool, has template params."""
    xml = """
    <doxygen>
      <compounddef id="nstest" kind="namespace" language="C++">
        <compoundname>test</compoundname>
        <sectiondef kind="var">
          <memberdef kind="variable" id="v1" static="no" constexpr="yes" mutable="no">
            <templateparamlist>
              <param><type>class T</type></param>
            </templateparamlist>
            <type>bool</type>
            <name>is_thing</name>
            <qualifiedname>test::is_thing</qualifiedname>
            <briefdescription></briefdescription>
            <detaileddescription></detaileddescription>
          </memberdef>
          <memberdef kind="variable" id="v2" static="no" constexpr="yes" mutable="no">
            <type>int</type>
            <name>some_int</name>
            <qualifiedname>test::some_int</qualifiedname>
            <briefdescription></briefdescription>
            <detaileddescription></detaileddescription>
          </memberdef>
          <memberdef kind="variable" id="v3" static="no" constexpr="yes" mutable="no">
            <type>bool</type>
            <name>just_bool</name>
            <qualifiedname>test::just_bool</qualifiedname>
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
    result = extract_namespace(cd)
    assert result is not None
    kwargs, _, _ = result

    # v1 is concept (constexpr bool + template params)
    assert len(kwargs["concepts"]) == 1
    assert kwargs["concepts"][0].name == "is_thing"

    # v2 is not concept (type is int, not bool)
    # v3 is not concept (no template params)
    assert len(kwargs["variables"]) == 2
    var_names = {v.name for v in kwargs["variables"]}
    assert "some_int" in var_names
    assert "just_bool" in var_names


def test_empty_namespace():
    xml = """
    <doxygen>
      <compounddef id="nsempty" kind="namespace" language="C++">
        <compoundname>empty_ns</compoundname>
        <briefdescription></briefdescription>
        <detaileddescription></detaileddescription>
      </compounddef>
    </doxygen>
    """
    tree = etree.fromstring(xml)
    cd = tree.find("compounddef")
    result = extract_namespace(cd)
    assert result is not None
    kwargs, inner_ns, inner_cls = result
    assert kwargs["name"] == "empty_ns"
    assert kwargs["functions"] == []
    assert kwargs["enums"] == []
    assert kwargs["typedefs"] == []
    assert kwargs["variables"] == []
    assert kwargs["concepts"] == []
    assert inner_ns == []
    assert inner_cls == []
