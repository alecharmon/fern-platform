"""Tests for visibility filtering in Python library docs parser."""

import pytest
from unittest.mock import Mock, MagicMock
from griffe import Module, Function, Class, Attribute


class TestGetPublicMembers:
    """Tests for parser.get_public_members()."""

    def test_includes_public_members(self):
        """Public members (no underscore) should be included."""
        from src.parser import get_public_members

        module = Mock(spec=Module)
        module.exports = None
        module.members = {
            "public_func": Mock(),
            "PublicClass": Mock(),
            "PUBLIC_CONST": Mock(),
        }

        result = get_public_members(module)

        assert "public_func" in result
        assert "PublicClass" in result
        assert "PUBLIC_CONST" in result

    def test_includes_protected_members(self):
        """Protected members (single underscore) should be included."""
        from src.parser import get_public_members

        module = Mock(spec=Module)
        module.exports = None
        module.members = {
            "_protected_func": Mock(),
            "_ProtectedClass": Mock(),
            "_protected_const": Mock(),
        }

        result = get_public_members(module)

        assert "_protected_func" in result
        assert "_ProtectedClass" in result
        assert "_protected_const" in result

    def test_excludes_private_members(self):
        """Private members (double underscore without trailing) should be excluded."""
        from src.parser import get_public_members

        module = Mock(spec=Module)
        module.exports = None
        module.members = {
            "__private_func": Mock(),
            "__PrivateClass": Mock(),
            "__private_const": Mock(),
        }

        result = get_public_members(module)

        assert "__private_func" not in result
        assert "__PrivateClass" not in result
        assert "__private_const" not in result

    def test_includes_dunder_members(self):
        """Dunder members (__name__) should be included."""
        from src.parser import get_public_members

        module = Mock(spec=Module)
        module.exports = None
        module.members = {
            "__init__": Mock(),
            "__str__": Mock(),
            "__all__": Mock(),
        }

        result = get_public_members(module)

        assert "__init__" in result
        assert "__str__" in result
        assert "__all__" in result

    def test_respects_all_export(self):
        """If __all__ is defined, use it instead of filtering."""
        from src.parser import get_public_members

        module = Mock(spec=Module)
        module.exports = ["exported_func", "_also_exported"]
        module.members = {
            "exported_func": Mock(),
            "_also_exported": Mock(),
            "not_exported": Mock(),
        }

        result = get_public_members(module)

        assert result == ["exported_func", "_also_exported"]

    def test_mixed_visibility(self):
        """Test with a mix of all visibility levels."""
        from src.parser import get_public_members

        module = Mock(spec=Module)
        module.exports = None
        module.members = {
            "public": Mock(),
            "_protected": Mock(),
            "__private": Mock(),
            "__dunder__": Mock(),
        }

        result = get_public_members(module)

        assert "public" in result
        assert "_protected" in result
        assert "__private" not in result
        assert "__dunder__" in result
        assert len(result) == 3


class TestIsPublic:
    """Tests for python_extractor._is_public()."""

    def test_public_member_is_public(self):
        """Public members should return True."""
        from src.extractor.python_extractor import PythonExtractor

        extractor = PythonExtractor.__new__(PythonExtractor)
        member = Mock()
        member.is_alias = False

        assert extractor._is_public("public_func", member) is True

    def test_protected_member_is_public(self):
        """Protected members (single underscore) should return True."""
        from src.extractor.python_extractor import PythonExtractor

        extractor = PythonExtractor.__new__(PythonExtractor)
        member = Mock()
        member.is_alias = False

        assert extractor._is_public("_protected_func", member) is True

    def test_private_member_is_not_public(self):
        """Private members (double underscore) should return False."""
        from src.extractor.python_extractor import PythonExtractor

        extractor = PythonExtractor.__new__(PythonExtractor)
        member = Mock()
        member.is_alias = False

        assert extractor._is_public("__private_func", member) is False

    def test_dunder_member_is_public(self):
        """Dunder members should return True."""
        from src.extractor.python_extractor import PythonExtractor

        extractor = PythonExtractor.__new__(PythonExtractor)
        member = Mock()
        member.is_alias = False

        assert extractor._is_public("__init__", member) is True
        assert extractor._is_public("__str__", member) is True

    def test_alias_is_not_public(self):
        """Aliases should return False."""
        from src.extractor.python_extractor import PythonExtractor

        extractor = PythonExtractor.__new__(PythonExtractor)
        member = Mock()
        member.is_alias = True

        assert extractor._is_public("some_alias", member) is False


class TestClassExtractorVisibility:
    """Tests for visibility filtering in class_extractor."""

    def test_extract_methods_includes_protected(self):
        """_extract_methods should include protected methods."""
        from src.extractor.class_extractor import ClassExtractor

        # Create mock parent with func_extractor
        parent = Mock()
        parent._func_extractor.extract.return_value = Mock(
            is_property=False, name="_protected_method"
        )

        extractor = ClassExtractor(parent)

        # Create mock class with protected method
        cls = Mock(spec=Class)
        protected_method = Mock(spec=Function)
        cls.members = {
            "_protected_method": protected_method,
        }

        result = extractor._extract_methods(cls)

        assert len(result) == 1
        parent._func_extractor.extract.assert_called_once_with(protected_method)

    def test_extract_methods_excludes_private(self):
        """_extract_methods should exclude private methods."""
        from src.extractor.class_extractor import ClassExtractor

        parent = Mock()
        extractor = ClassExtractor(parent)

        cls = Mock(spec=Class)
        private_method = Mock(spec=Function)
        cls.members = {
            "__private_method": private_method,
        }

        result = extractor._extract_methods(cls)

        assert len(result) == 0
        parent._func_extractor.extract.assert_not_called()

    def test_extract_methods_includes_dunder(self):
        """_extract_methods should include dunder methods (except __init__)."""
        from src.extractor.class_extractor import ClassExtractor

        parent = Mock()
        parent._func_extractor.extract.return_value = Mock(
            is_property=False, name="__str__"
        )

        extractor = ClassExtractor(parent)

        cls = Mock(spec=Class)
        dunder_method = Mock(spec=Function)
        cls.members = {
            "__str__": dunder_method,
        }

        result = extractor._extract_methods(cls)

        assert len(result) == 1
        parent._func_extractor.extract.assert_called_once_with(dunder_method)

    def test_extract_methods_excludes_init(self):
        """_extract_methods should exclude __init__."""
        from src.extractor.class_extractor import ClassExtractor

        parent = Mock()
        extractor = ClassExtractor(parent)

        cls = Mock(spec=Class)
        init_method = Mock(spec=Function)
        cls.members = {
            "__init__": init_method,
        }

        result = extractor._extract_methods(cls)

        assert len(result) == 0
