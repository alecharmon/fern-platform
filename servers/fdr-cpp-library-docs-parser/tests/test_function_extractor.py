"""Tests for function_extractor module."""

from pathlib import Path

from lxml import etree

from src.extractor.function_extractor import extract_function

FIXTURES = Path(__file__).parent / "fixtures"


def _load_memberdef(filename):
    tree = etree.parse(str(FIXTURES / filename))
    return tree.getroot()


def test_full_function():
    md = _load_memberdef("function_full.xml")
    func = extract_function(md)
    assert func is not None

    assert func.name == "my_func"
    assert func.path == "my_ns::my_func"
    assert "my_ns::my_func" in func.signature
    assert "(const T &input, int count = 0)" in func.signature

    # Modifiers
    assert func.is_static is True
    assert func.is_const is True
    assert func.is_constexpr is True
    assert func.is_volatile is False
    assert func.is_inline is True
    assert func.is_explicit is False
    assert func.is_noexcept is True
    assert func.is_no_discard is True
    assert func.is_deleted is False

    # Noexcept expression
    assert func.noexcept_expression is not None
    assert "std::is_nothrow_copy_constructible_v" in func.noexcept_expression
    assert not func.noexcept_expression.startswith("noexcept(")

    # Virtuality
    assert func.virtuality == "virtual"

    # Ref qualifier
    assert func.ref_qualifier == "lvalue"

    # Requires clause
    assert func.requires_clause == "requires std::integral<T>"

    # Template params
    assert len(func.template_params) == 1
    assert func.template_params[0].name == "T"

    # Parameters
    assert len(func.parameters) == 2
    assert func.parameters[0].name == "input"
    assert func.parameters[0].type_info is not None
    assert func.parameters[0].type_info.display == "const T &"
    assert func.parameters[1].name == "count"
    assert func.parameters[1].default_value is not None
    assert func.parameters[1].default_value.display == "0"

    # Return type
    assert func.return_type is not None
    assert func.return_type.display == "const T &"

    # Docstring
    assert func.docstring is not None


def test_deleted_function():
    md = _load_memberdef("function_deleted.xml")
    func = extract_function(md)
    assert func is not None
    assert func.name == "deleted_func"
    assert func.is_deleted is True
    assert func.is_static is False
    assert func.virtuality == "non-virtual"
    assert func.ref_qualifier is None

    # Parameter with ref in type
    assert len(func.parameters) == 1
    assert func.parameters[0].type_info is not None
    assert "MyClass" in func.parameters[0].type_info.display


def test_function_with_array_suffix():
    xml = """
    <memberdef kind="function" id="f1" static="no" const="no" constexpr="no"
               volatile="no" inline="no" explicit="no" noexcept="no" nodiscard="no" virt="non-virtual">
      <type>void</type>
      <definition>void sort</definition>
      <argsstring>(KeyT (&amp;keys)[N])</argsstring>
      <name>sort</name>
      <qualifiedname>cub::BlockRadixSort::sort</qualifiedname>
      <param>
        <type>KeyT (&amp;)</type>
        <declname>keys</declname>
        <array>[N]</array>
      </param>
      <briefdescription></briefdescription>
      <detaileddescription></detaileddescription>
    </memberdef>
    """
    md = etree.fromstring(xml)
    func = extract_function(md)
    assert func is not None
    assert len(func.parameters) == 1
    assert func.parameters[0].name == "keys"
    assert func.parameters[0].array_suffix == "[N]"


def test_function_no_docstring():
    xml = """
    <memberdef kind="function" id="f2" static="no" const="no" constexpr="no"
               volatile="no" inline="no" explicit="no" noexcept="no" nodiscard="no" virt="non-virtual">
      <type>void</type>
      <definition>void noop</definition>
      <argsstring>()</argsstring>
      <name>noop</name>
      <qualifiedname>noop</qualifiedname>
      <briefdescription></briefdescription>
      <detaileddescription></detaileddescription>
    </memberdef>
    """
    md = etree.fromstring(xml)
    func = extract_function(md)
    assert func is not None
    assert func.docstring is None
