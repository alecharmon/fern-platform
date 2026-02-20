"""Python library docs IR extractor.

This module extracts structured IR (Intermediate Representation) from
Python libraries parsed with Griffe. The IR can then be rendered to
MDX or other formats.

Usage:
    from src.extractor import PythonExtractor
    from src.parser import parse_package

    module = parse_package(package_path)
    extractor = PythonExtractor(module)
    ir = extractor.extract(source_url="https://github.com/...", branch="main")

    # Convert to dict for JSON serialization
    ir_dict = ir.model_dump(by_alias=True)

    # Or use the convenience function:
    from src.extractor import extract_python_ir
    ir = extract_python_ir(module, source_url="https://github.com/...")
"""

from .python_extractor import PythonExtractor, extract_python_ir

# Re-export types from generated SDK
from src.generated import (
    AttributeIr,
    DocstringExampleIr,
    DocstringIr,
    DocstringParamIr,
    DocstringRaisesIr,
    DocstringReturnsIr,
    IrMetadata,
    TypeInfo,
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
    # Main extraction class and function
    "PythonExtractor",
    "extract_python_ir",
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
