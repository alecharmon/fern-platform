"""Python library docs IR extractor.

This module extracts structured IR (Intermediate Representation) from
Python libraries parsed with Griffe. The IR can then be rendered to
MDX or other formats.

Usage:
    from src.extractor import extract_python_ir
    from src.parser import parse_package

    module = parse_package(package_path)
    ir = extract_python_ir(module, source_url="https://github.com/...", branch="main")

    # Convert to dict for JSON serialization
    ir_dict = ir.model_dump(by_alias=True)
"""

from .module_extractor import extract_python_ir, extract_module

# Re-export types from generated SDK
from src.generated.library_docs import (
    # Shared IR types
    AttributeIr,
    DocstringExampleIr,
    DocstringIr,
    DocstringParamIr,
    DocstringRaisesIr,
    DocstringReturnsIr,
    IrMetadata,
    TypeInfo,
    # Python-specific types
    EnumMemberIr,
    PythonClassIr,
    PythonClassKind,
    PythonFunctionIr,
    PythonLibraryDocsIr,
    PythonModuleIr,
    PythonParameterIr,
    PythonParameterKind,
    TypedDictFieldIr,
)

__all__ = [
    # Main extraction function
    "extract_python_ir",
    "extract_module",
    # Shared IR types
    "AttributeIr",
    "DocstringExampleIr",
    "DocstringIr",
    "DocstringParamIr",
    "DocstringRaisesIr",
    "DocstringReturnsIr",
    "IrMetadata",
    "TypeInfo",
    # Python-specific types
    "EnumMemberIr",
    "PythonClassIr",
    "PythonClassKind",
    "PythonFunctionIr",
    "PythonLibraryDocsIr",
    "PythonModuleIr",
    "PythonParameterIr",
    "PythonParameterKind",
    "TypedDictFieldIr",
]
