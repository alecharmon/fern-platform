"""Extract PythonClassIr from Griffe classes."""

from griffe import Class, Function, Attribute

from src.generated.library_docs import (
    AttributeIr,
    BaseClassRef,
    EnumMemberIr,
    PythonClassIr,
    PythonFunctionIr,
    PythonParameterIr,
    TypedDictFieldIr,
)

from .docstring_extractor import extract_docstring
from .function_extractor import extract_function, _extract_parameter
from .type_resolver import make_type_info


def extract_class(cls: Class) -> PythonClassIr:
    """
    Extract PythonClassIr from a Griffe Class.

    Args:
        cls: Griffe Class object.

    Returns:
        PythonClassIr with all class information.
    """
    kind = _detect_class_kind(cls)
    decorators = _extract_decorators(cls)
    bases = _extract_bases(cls)

    # Detect class properties (use base names for checks)
    base_names = [b.name for b in bases]
    is_abstract = any("ABC" in b or "ABCMeta" in b for b in base_names) or any(
        "abstractmethod" in d for d in decorators
    )
    has_slots = hasattr(cls, "__slots__") or any(
        name == "__slots__" for name in cls.members.keys()
    )

    # Get metaclass if present
    metaclass = None
    # Check class keywords for metaclass
    if hasattr(cls, "keywords"):
        for kw in cls.keywords:
            # Handle both object and string forms
            if hasattr(kw, "name"):
                if kw.name == "metaclass":
                    metaclass = str(kw.value)
            elif isinstance(kw, str) and kw.startswith("metaclass="):
                metaclass = kw.split("=", 1)[1]

    # Extract constructor parameters
    constructor_params = _extract_constructor_params(cls)

    # Extract class members
    methods = _extract_methods(cls)
    attributes = _extract_attributes(cls)

    # TypedDict and Enum specific fields
    typeddict_fields = None
    enum_members = None

    if kind == "TYPEDDICT":
        typeddict_fields = _extract_typeddict_fields(cls)
    elif kind == "ENUM":
        enum_members = _extract_enum_members(cls)

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


def _detect_class_kind(cls: Class) -> str:
    """Detect the kind of Python class."""
    base_names = [str(b) for b in cls.bases] if cls.bases else []

    # Check for Protocol
    if any("Protocol" in b for b in base_names):
        return "PROTOCOL"

    # Check for TypedDict
    if any("TypedDict" in b for b in base_names):
        return "TYPEDDICT"

    # Check for Enum
    if any("Enum" in b for b in base_names):
        return "ENUM"

    # Check for Exception
    if any(
        b in ("Exception", "BaseException") or "Exception" in b for b in base_names
    ):
        return "EXCEPTION"

    # Check for dataclass decorator
    for decorator in cls.decorators:
        decorator_str = (
            str(decorator.value) if hasattr(decorator, "value") else str(decorator)
        )
        if "dataclass" in decorator_str:
            return "DATACLASS"

    return "CLASS"


def _extract_decorators(cls: Class) -> list[str]:
    """Extract decorator names from a class."""
    decorators = []
    for decorator in cls.decorators:
        dec_str = (
            str(decorator.value) if hasattr(decorator, "value") else str(decorator)
        )
        if dec_str.startswith("@"):
            dec_str = dec_str[1:]
        decorators.append(dec_str)
    return decorators


def _extract_bases(cls: Class) -> list[BaseClassRef]:
    """Extract base classes with type info for cross-linking."""
    if not cls.bases:
        return []

    bases = []
    for base in cls.bases:
        name = str(base)
        type_info = make_type_info(base)
        bases.append(BaseClassRef(name=name, type_info=type_info))
    return bases


def _extract_constructor_params(cls: Class) -> list[PythonParameterIr]:
    """Extract constructor parameters from __init__."""
    init_method = cls.members.get("__init__")
    if not isinstance(init_method, Function):
        return []

    # Get parameters excluding self
    params = []
    for param in init_method.parameters:
        if param.name != "self":
            params.append(_extract_parameter(param))

    return params


def _extract_methods(cls: Class) -> list[PythonFunctionIr]:
    """Extract methods from a class."""
    methods = []
    for name, member in cls.members.items():
        if isinstance(member, Function):
            # Skip __init__ (documented in constructor_params)
            if name == "__init__":
                continue
            # Skip private members (start with _) unless dunder
            if name.startswith("_") and not (
                name.startswith("__") and name.endswith("__")
            ):
                continue
            methods.append(extract_function(member))

    return sorted(methods, key=lambda m: (not m.is_property, m.name))


def _extract_attributes(cls: Class) -> list[AttributeIr]:
    """Extract attributes from a class."""
    attributes = []
    for name, member in cls.members.items():
        if isinstance(member, Attribute):
            # Skip private members
            if name.startswith("_"):
                continue

            attr_ir = AttributeIr(
                name=name,
                path=member.path,
                type_info=make_type_info(member.annotation),
                value=str(member.value) if member.value is not None else None,
                docstring=extract_docstring(member.docstring),
            )
            attributes.append(attr_ir)

    return sorted(attributes, key=lambda a: a.name)


def _extract_typeddict_fields(cls: Class) -> list[TypedDictFieldIr]:
    """Extract TypedDict fields."""
    fields = []

    for name, member in cls.members.items():
        if isinstance(member, Attribute):
            # Skip dunder fields like __extra__
            if name.startswith("_"):
                continue

            type_info = make_type_info(member.annotation)

            # Check if NotRequired based on resolved path
            resolved = type_info.resolved_path if type_info else None
            required = resolved is None or "NotRequired" not in resolved

            # Get description from docstring
            description = None
            if member.docstring:
                description = member.docstring.value

            fields.append(
                TypedDictFieldIr(
                    name=name,
                    type_info=type_info,
                    description=description,
                    required=required,
                )
            )

    return sorted(fields, key=lambda f: f.name)


def _extract_enum_members(cls: Class) -> list[EnumMemberIr]:
    """Extract enum members."""
    members = []

    for name, member in cls.members.items():
        if isinstance(member, Attribute) and not name.startswith("_"):
            value = str(member.value) if member.value is not None else ""
            members.append(EnumMemberIr(name=name, value=value))

    return sorted(members, key=lambda m: m.name)
