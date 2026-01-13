"""Main Python library extractor using composition."""

from typing import Optional

from griffe import Module, Class, Function, Attribute

from src.generated.library_docs import (
    AttributeIr,
    IrMetadata,
    PythonLibraryDocsIr,
    PythonModuleIr,
    TypeInfo,
)

from .class_extractor import ClassExtractor
from .docstring_extractor import extract_docstring
from .function_extractor import FunctionExtractor
from .type_resolver import get_base_path, resolve_annotation


class PythonExtractor:
    """
    Extracts PythonLibraryDocsIr from Griffe modules.

    Uses composition with ClassExtractor and FunctionExtractor for
    clean separation of concerns. Holds extraction context (loaded_roots)
    as instance state for internal type detection.

    Usage:
        extractor = PythonExtractor(griffe_module)
        ir = extractor.extract(source_url="https://github.com/...")
    """

    def __init__(self, griffe_module: Module):
        self.griffe_module = griffe_module
        self.loaded_roots = self._get_loaded_roots()

        # Composed extractors
        self._class_extractor = ClassExtractor(self)
        self._func_extractor = FunctionExtractor(self)

    def _get_loaded_roots(self) -> set[str]:
        """Get root module names from Griffe's modules_collection."""
        try:
            collection = self.griffe_module.modules_collection
            if collection and hasattr(collection, "members"):
                return set(collection.members.keys())
        except Exception:
            pass
        return {self.griffe_module.name}

    def extract(
        self,
        source_url: Optional[str] = None,
        branch: Optional[str] = None,
        version: Optional[str] = None,
    ) -> PythonLibraryDocsIr:
        """Extract PythonLibraryDocsIr from the Griffe module."""
        metadata = IrMetadata(
            package_name=self.griffe_module.name,
            language="python",
            source_url=source_url,
            branch=branch,
            version=version,
        )
        return PythonLibraryDocsIr(
            metadata=metadata,
            root_module=self._extract_module(self.griffe_module),
        )

    def make_type_info(self, annotation) -> Optional[TypeInfo]:
        """
        Create TypeInfo from a Griffe annotation.

        Only sets basePath for internal types (within loaded modules).
        External types have basePath=None to prevent broken links.
        """
        if annotation is None:
            return None

        resolved_path = resolve_annotation(annotation)
        if not resolved_path:
            return None

        base_path = get_base_path(annotation)

        # Filter external types
        if base_path:
            root = base_path.split(".")[0]
            if root not in self.loaded_roots:
                base_path = None

        return TypeInfo(
            display=resolve_annotation(annotation, use_short_names=True),
            resolved_path=resolved_path,
            base_path=base_path,
        )

    def _extract_module(self, griffe_module: Module) -> PythonModuleIr:
        """Extract PythonModuleIr from a Griffe Module."""
        classes, functions, attributes, submodules = [], [], [], []

        for name, member in griffe_module.members.items():
            if not self._is_public(name, member):
                continue

            if isinstance(member, Class):
                classes.append(self._class_extractor.extract(member))
            elif isinstance(member, Function):
                functions.append(self._func_extractor.extract(member))
            elif isinstance(member, Attribute):
                attributes.append(self._make_attribute_ir(name, member))
            elif isinstance(member, Module):
                submodules.append(self._extract_module(member))

        return PythonModuleIr(
            name=griffe_module.name,
            path=griffe_module.path,
            docstring=extract_docstring(griffe_module.docstring),
            classes=sorted(classes, key=lambda c: c.name),
            functions=sorted(functions, key=lambda f: f.name),
            attributes=sorted(attributes, key=lambda a: a.name),
            submodules=sorted(submodules, key=lambda m: m.name),
        )

    def _is_public(self, name: str, member) -> bool:
        """Check if a member should be documented.

        Includes protected members (single underscore prefix like _helper)
        but excludes truly private members (double underscore prefix like __internal).
        Dunder methods (__str__, __repr__) are included.
        """
        # Skip truly private members (double underscore prefix without trailing __)
        if name.startswith("__") and not name.endswith("__"):
            return False
        return not (hasattr(member, "is_alias") and member.is_alias)

    def _make_attribute_ir(self, name: str, member: Attribute) -> AttributeIr:
        """Create AttributeIr from a Griffe Attribute."""
        return AttributeIr(
            name=name,
            path=member.path,
            type_info=self.make_type_info(member.annotation),
            value=str(member.value) if member.value is not None else None,
            docstring=extract_docstring(member.docstring),
        )


def extract_python_ir(
    griffe_module: Module,
    source_url: Optional[str] = None,
    branch: Optional[str] = None,
    version: Optional[str] = None,
) -> PythonLibraryDocsIr:
    """Convenience function for backward compatibility."""
    return PythonExtractor(griffe_module).extract(
        source_url=source_url, branch=branch, version=version
    )
