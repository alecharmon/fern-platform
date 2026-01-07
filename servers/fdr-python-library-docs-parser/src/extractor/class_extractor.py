"""Class extraction for Python library docs."""

from __future__ import annotations
from typing import TYPE_CHECKING

from griffe import Class, Function, Attribute

from src.generated.library_docs import (
    AttributeIr,
    BaseClassRef,
    EnumMemberIr,
    PythonClassIr,
    PythonFunctionIr,
    TypedDictFieldIr,
)

from .docstring_extractor import extract_docstring
from .function_extractor import _extract_decorators

if TYPE_CHECKING:
    from .python_extractor import PythonExtractor


class ClassExtractor:
    """Extracts class IR from Griffe Class objects."""

    def __init__(self, parent: PythonExtractor):
        self.parent = parent

    def extract(self, cls: Class) -> PythonClassIr:
        """Extract PythonClassIr from a Griffe Class."""
        kind = self._detect_kind(cls)
        decorators = _extract_decorators(cls)
        bases = self._extract_bases(cls)

        # Detect class properties
        base_names = [b.name for b in bases]
        is_abstract = (
            any("ABC" in b or "ABCMeta" in b for b in base_names)
            or any("abstractmethod" in d for d in decorators)
        )
        has_slots = "__slots__" in cls.members

        # Get metaclass if present
        metaclass = self._extract_metaclass(cls)

        # Extract members
        constructor_params = self._extract_constructor_params(cls)
        methods = self._extract_methods(cls)
        attributes = self._extract_attributes(cls)

        # Kind-specific fields
        typeddict_fields = self._extract_typeddict_fields(cls) if kind == "TYPEDDICT" else None
        enum_members = self._extract_enum_members(cls) if kind == "ENUM" else None

        return PythonClassIr(
            name=cls.name,
            path=cls.path,
            kind=kind,
            bases=bases,
            docstring=extract_docstring(cls.docstring),
            constructor_params=constructor_params,
            methods=methods,
            attributes=attributes,
            decorators=decorators,
            metaclass=metaclass,
            is_abstract=is_abstract,
            has_slots=has_slots,
            typed_dict_fields=typeddict_fields,
            enum_members=enum_members,
        )

    def _detect_kind(self, cls: Class) -> str:
        """Detect the kind of Python class."""
        base_names = [str(b) for b in cls.bases] if cls.bases else []

        if any("Protocol" in b for b in base_names):
            return "PROTOCOL"
        if any("TypedDict" in b for b in base_names):
            return "TYPEDDICT"
        if any("Enum" in b for b in base_names):
            return "ENUM"
        if any(b in ("Exception", "BaseException") or "Exception" in b for b in base_names):
            return "EXCEPTION"

        # Check for dataclass decorator
        for decorator in cls.decorators:
            dec_str = str(decorator.value) if hasattr(decorator, "value") else str(decorator)
            if "dataclass" in dec_str:
                return "DATACLASS"

        return "CLASS"

    def _extract_metaclass(self, cls: Class) -> str | None:
        """Extract metaclass if present."""
        if not hasattr(cls, "keywords"):
            return None
        for kw in cls.keywords:
            if hasattr(kw, "name") and kw.name == "metaclass":
                return str(kw.value)
            if isinstance(kw, str) and kw.startswith("metaclass="):
                return kw.split("=", 1)[1]
        return None

    def _extract_bases(self, cls: Class) -> list[BaseClassRef]:
        """Extract base classes with type info for cross-linking."""
        if not cls.bases:
            return []
        return [
            BaseClassRef(name=str(base), type_info=self.parent.make_type_info(base))
            for base in cls.bases
        ]

    def _extract_constructor_params(self, cls: Class):
        """Extract constructor parameters from __init__."""
        init_method = cls.members.get("__init__")
        if not isinstance(init_method, Function):
            return []
        return [
            self.parent._func_extractor._extract_parameter(param)
            for param in init_method.parameters
            if param.name != "self"
        ]

    def _extract_methods(self, cls: Class) -> list[PythonFunctionIr]:
        """Extract methods from a class."""
        methods = []
        for name, member in cls.members.items():
            if not isinstance(member, Function):
                continue
            if name == "__init__":
                continue
            if name.startswith("_") and not (name.startswith("__") and name.endswith("__")):
                continue
            methods.append(self.parent._func_extractor.extract(member))

        return sorted(methods, key=lambda m: (not m.is_property, m.name))

    def _extract_attributes(self, cls: Class) -> list[AttributeIr]:
        """Extract attributes from a class."""
        return sorted(
            [
                self._make_attribute_ir(name, member)
                for name, member in cls.members.items()
                if isinstance(member, Attribute) and not name.startswith("_")
            ],
            key=lambda a: a.name,
        )

    def _extract_typeddict_fields(self, cls: Class) -> list[TypedDictFieldIr]:
        """Extract TypedDict fields."""
        fields = []
        for name, member in cls.members.items():
            if not isinstance(member, Attribute) or name.startswith("_"):
                continue

            type_info = self.parent.make_type_info(member.annotation)
            resolved = type_info.resolved_path if type_info else None
            required = resolved is None or "NotRequired" not in resolved

            fields.append(
                TypedDictFieldIr(
                    name=name,
                    type_info=type_info,
                    description=member.docstring.value if member.docstring else None,
                    required=required,
                )
            )

        return sorted(fields, key=lambda f: f.name)

    def _extract_enum_members(self, cls: Class) -> list[EnumMemberIr]:
        """Extract enum members."""
        return sorted(
            [
                EnumMemberIr(name=name, value=str(member.value) if member.value else "")
                for name, member in cls.members.items()
                if isinstance(member, Attribute) and not name.startswith("_")
            ],
            key=lambda m: m.name,
        )

    def _make_attribute_ir(self, name: str, member: Attribute) -> AttributeIr:
        """Create an AttributeIr from a Griffe Attribute."""
        return AttributeIr(
            name=name,
            path=member.path,
            type_info=self.parent.make_type_info(member.annotation),
            value=str(member.value) if member.value is not None else None,
            docstring=extract_docstring(member.docstring),
        )
