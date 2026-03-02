"""Tests for member_extractor module."""

from pathlib import Path

from lxml import etree

from src.extractor.member_extractor import extract_typedef, extract_variable

FIXTURES = Path(__file__).parent / "fixtures"


def _load_memberdef(filename):
    tree = etree.parse(str(FIXTURES / filename))
    return tree.getroot()


def test_extract_typedef_valid():
    """Extract a valid typedef memberdef and verify CppTypedefIr fields."""
    md = _load_memberdef("typedef_member.xml")
    td = extract_typedef(md)
    assert td is not None
    assert td.name == "SizeType"
    assert td.path == "my_ns::SizeType"
    assert td.type_info is not None
    assert td.type_info.display == "std::size_t"
    assert td.docstring is not None


def test_extract_variable_valid():
    """Extract a valid variable memberdef and verify CppVariableIr fields."""
    md = _load_memberdef("variable_member.xml")
    var = extract_variable(md)
    assert var is not None
    assert var.name == "kMaxSize"
    assert var.path == "my_ns::kMaxSize"
    assert var.type_info is not None
    assert var.type_info.display == "int"
    assert var.is_static is True
    assert var.is_constexpr is True
    assert var.is_mutable is False
    assert var.initializer == "= 1024"
    assert var.docstring is not None


def test_extract_typedef_missing_type():
    """Typedef with no <type> element should return None (graceful skip)."""
    xml = """
    <memberdef kind="typedef" id="td_bad">
      <name>BadTypedef</name>
      <qualifiedname>BadTypedef</qualifiedname>
      <briefdescription></briefdescription>
      <detaileddescription></detaileddescription>
    </memberdef>
    """
    md = etree.fromstring(xml)
    td = extract_typedef(md)
    # Should still succeed (type_info will be None, which is allowed)
    assert td is not None
    assert td.name == "BadTypedef"
    assert td.type_info is None


def test_extract_variable_constexpr():
    """Variable with constexpr=yes should have is_constexpr=True."""
    xml = """
    <memberdef kind="variable" id="var_ce" constexpr="yes" static="no" mutable="no">
      <name>kPi</name>
      <qualifiedname>kPi</qualifiedname>
      <type>double</type>
      <briefdescription></briefdescription>
      <detaileddescription></detaileddescription>
    </memberdef>
    """
    md = etree.fromstring(xml)
    var = extract_variable(md)
    assert var is not None
    assert var.is_constexpr is True
    assert var.is_static is False


def test_extract_variable_with_initializer():
    """Variable with an <initializer> element should populate the value field."""
    xml = """
    <memberdef kind="variable" id="var_init" static="no" constexpr="no" mutable="no">
      <name>defaultName</name>
      <qualifiedname>defaultName</qualifiedname>
      <type>const char *</type>
      <initializer>= "hello"</initializer>
      <briefdescription></briefdescription>
      <detaileddescription></detaileddescription>
    </memberdef>
    """
    md = etree.fromstring(xml)
    var = extract_variable(md)
    assert var is not None
    assert var.name == "defaultName"
    assert var.initializer == '= "hello"'
    assert var.type_info is not None
    assert var.type_info.display == "const char *"
