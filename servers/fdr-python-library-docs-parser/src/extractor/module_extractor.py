"""Extract PythonLibraryDocsIr from Griffe modules."""

from typing import Optional

from griffe import Module, Class, Function, Attribute

from src.generated.library_docs import (
    AttributeIr,
    IrMetadata,
    PythonLibraryDocsIr,
    PythonModuleIr,
)

from .class_extractor import extract_class
from .docstring_extractor import extract_docstring
from .function_extractor import extract_function, _format_annotation


def extract_python_ir(
    griffe_module: Module,
    source_url: Optional[str] = None,
    branch: Optional[str] = None,
    version: Optional[str] = None,
) -> PythonLibraryDocsIr:
    """
    Extract PythonLibraryDocsIr from a Griffe Module.

    This is the main entry point for extracting IR from parsed Python code.

    Args:
        griffe_module: Griffe Module object (root of the parsed library).
        source_url: Optional GitHub URL of the source repository.
        branch: Optional branch name.
        version: Optional version string.

    Returns:
        PythonLibraryDocsIr containing all extracted information.
    """
    metadata = IrMetadata(
        package_name=griffe_module.name,
        language="python",
        source_url=source_url,
        branch=branch,
        version=version,
    )

    root_module = extract_module(griffe_module)

    return PythonLibraryDocsIr(
        metadata=metadata,
        root_module=root_module,
    )


def extract_module(griffe_module: Module) -> PythonModuleIr:
    """
    Extract PythonModuleIr from a Griffe Module.

    Args:
        griffe_module: Griffe Module object.

    Returns:
        PythonModuleIr with all module information.
    """
    # Extract classes
    classes = []
    for name, member in griffe_module.members.items():
        if isinstance(member, Class):
            if _is_public_member(name, member):
                classes.append(extract_class(member))

    # Extract functions
    functions = []
    for name, member in griffe_module.members.items():
        if isinstance(member, Function):
            if _is_public_member(name, member):
                functions.append(extract_function(member))

    # Extract module-level attributes
    attributes = []
    for name, member in griffe_module.members.items():
        if isinstance(member, Attribute):
            if _is_public_member(name, member):
                attr_ir = AttributeIr(
                    name=name,
                    path=member.path,
                    type=_format_annotation(member.annotation) if member.annotation else None,
                    value=str(member.value) if member.value is not None else None,
                    docstring=extract_docstring(member.docstring),
                )
                attributes.append(attr_ir)

    # Extract submodules recursively
    submodules = []
    for name, member in griffe_module.members.items():
        if isinstance(member, Module):
            if _is_public_member(name, member):
                submodules.append(extract_module(member))

    return PythonModuleIr(
        name=griffe_module.name,
        path=griffe_module.path,
        docstring=extract_docstring(griffe_module.docstring),
        classes=sorted(classes, key=lambda c: c.name),
        functions=sorted(functions, key=lambda f: f.name),
        attributes=sorted(attributes, key=lambda a: a.name),
        submodules=sorted(submodules, key=lambda m: m.name),
    )


def _is_public_member(name: str, member) -> bool:
    """Check if a member is public (should be documented)."""
    # Skip private members
    if name.startswith("_") and not (name.startswith("__") and name.endswith("__")):
        return False

    # Skip imported members (they belong to their original module)
    if hasattr(member, "is_alias") and member.is_alias:
        return False

    return True
