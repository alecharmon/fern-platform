"""Tests for type_resolver module."""

from pathlib import Path

from lxml import etree

from src.extractor.type_resolver import (
    build_refid_map,
    extract_template_params,
    parse_type_info,
)
from src.generated import CppTypeRef

FIXTURES = Path(__file__).parent / "fixtures"


def test_parse_type_info_plain_text():
    elem = etree.fromstring("<type>int</type>")
    ti = parse_type_info(elem)
    assert ti is not None
    assert ti.display == "int"
    assert len(ti.parts) == 1
    assert ti.parts[0] == "int"


def test_parse_type_info_with_ref():
    xml = FIXTURES / "type_with_ref.xml"
    elem = etree.parse(str(xml)).getroot()
    ti = parse_type_info(elem)
    assert ti is not None
    assert ti.display == "const MyClass &"
    assert len(ti.parts) == 3
    assert ti.parts[0] == "const "
    assert isinstance(ti.parts[1], CppTypeRef)
    assert ti.parts[1].text == "MyClass"
    assert ti.parts[1].refid == "classMyClass"
    assert ti.parts[1].kindref == "compound"
    assert ti.parts[2] == " &"


def test_parse_type_info_none():
    assert parse_type_info(None) is None


def test_parse_type_info_empty():
    elem = etree.fromstring("<type></type>")
    assert parse_type_info(elem) is None


def test_extract_template_params():
    xml = FIXTURES / "template_params.xml"
    tree = etree.parse(str(xml))
    root = tree.getroot()
    params = extract_template_params(root)
    assert len(params) == 3

    assert params[0].type == "typename"
    assert params[0].name == "T"
    assert params[0].default_value is None
    assert params[0].is_variadic is False

    assert params[1].type == "int"
    assert params[1].name == "N"
    assert params[1].default_value is not None
    assert params[1].default_value.display == "16"
    assert params[1].is_variadic is False

    assert params[2].type == "typename..."
    assert params[2].name == "Args"
    assert params[2].is_variadic is True


def test_extract_template_params_variadic_preserves_ellipsis():
    """Regression: variadic template param types must preserve the '...' suffix.

    XML like <type>class...</type> must produce type="class...", not type="class".
    See: 50 mismatches across CUB/Thrust/libcudacxx corpora.
    """
    xml = FIXTURES / "template_params_variadic.xml"
    tree = etree.parse(str(xml))
    root = tree.getroot()
    params = extract_template_params(root)
    assert len(params) == 4

    # class... must preserve ellipsis
    assert params[0].type == "class..."
    assert params[0].name == "Properties"
    assert params[0].is_variadic is True

    # typename... must preserve ellipsis
    assert params[1].type == "typename..."
    assert params[1].name == "Args"
    assert params[1].is_variadic is True

    # size_t... must preserve ellipsis
    assert params[2].type == "size_t..."
    assert params[2].name == "Indices"
    assert params[2].is_variadic is True

    # Non-variadic param unchanged
    assert params[3].type == "typename"
    assert params[3].name == "T"
    assert params[3].is_variadic is False


def test_extract_template_params_name_from_type_fallback():
    xml = FIXTURES / "template_params_no_declname.xml"
    tree = etree.parse(str(xml))
    root = tree.getroot()
    params = extract_template_params(root)
    assert len(params) == 7

    # "typename T" -> name = "T"
    assert params[0].type == "typename T"
    assert params[0].name == "T"
    assert params[0].is_variadic is False

    # "class DerivedPolicy" -> name = "DerivedPolicy"
    assert params[1].type == "class DerivedPolicy"
    assert params[1].name == "DerivedPolicy"
    assert params[1].is_variadic is False

    # "typename... Args" -> name = "Args", variadic
    assert params[2].type == "typename... Args"
    assert params[2].name == "Args"
    assert params[2].is_variadic is True

    # "size_t" (bare non-type keyword) -> name = None
    assert params[3].type == "size_t"
    assert params[3].name is None

    # "int" -> name = None
    assert params[4].type == "int"
    assert params[4].name is None

    # "typename" alone -> name = None
    assert params[5].type == "typename"
    assert params[5].name is None

    # SFINAE pattern with < and > -> name = None
    assert params[6].name is None


def test_extract_template_params_none():
    elem = etree.fromstring("<memberdef></memberdef>")
    params = extract_template_params(elem)
    assert params == []


def test_build_refid_map():
    index_xml = FIXTURES / "e2e_xml" / "index.xml"
    refid_map = build_refid_map(str(index_xml))
    assert "namespacemy__ns" in refid_map
    assert refid_map["namespacemy__ns"] == "my_ns"
    assert "classmy__ns_1_1Widget" in refid_map
    assert refid_map["classmy__ns_1_1Widget"] == "my_ns::Widget"
    assert "func010" in refid_map
    assert refid_map["func010"] == "free_func"
