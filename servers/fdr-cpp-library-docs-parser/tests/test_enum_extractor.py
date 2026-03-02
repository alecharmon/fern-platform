"""Tests for enum_extractor module."""

from pathlib import Path

from lxml import etree

from src.extractor.enum_extractor import extract_enum

FIXTURES = Path(__file__).parent / "fixtures"


def _load_memberdef(filename):
    tree = etree.parse(str(FIXTURES / filename))
    return tree.getroot()


def test_scoped_enum():
    md = _load_memberdef("enum_scoped.xml")
    en = extract_enum(md)
    assert en is not None

    assert en.name == "Color"
    assert en.path == "my_ns::Color"
    assert en.is_scoped is True
    assert en.underlying_type == "unsigned int"

    assert len(en.values) == 3
    assert en.values[0].name == "Red"
    assert en.values[0].id == "enumval001"
    assert en.values[0].initializer == "= 0"
    assert en.values[0].docstring is not None

    assert en.values[1].name == "Green"
    assert en.values[1].initializer == "= 1"

    assert en.values[2].name == "Blue"
    assert en.values[2].initializer is None

    assert en.docstring is not None


def test_unscoped_enum():
    md = _load_memberdef("enum_unscoped.xml")
    en = extract_enum(md)
    assert en is not None

    assert en.name == "Flags"
    assert en.path == "my_ns::Flags"
    assert en.is_scoped is False
    assert en.underlying_type is None

    assert len(en.values) == 1
    assert en.values[0].name == "FlagA"
    assert en.values[0].initializer == "= 0x1"


def test_enum_no_underlying_type():
    xml = """
    <memberdef kind="enum" id="e1" strong="no">
      <name>Simple</name>
      <qualifiedname>Simple</qualifiedname>
      <enumvalue id="ev1"><name>A</name></enumvalue>
      <briefdescription></briefdescription>
      <detaileddescription></detaileddescription>
    </memberdef>
    """
    md = etree.fromstring(xml)
    en = extract_enum(md)
    assert en is not None
    assert en.underlying_type is None
    assert en.is_scoped is False
    assert len(en.values) == 1
