"""Function extraction for Python library docs."""

from __future__ import annotations
from typing import TYPE_CHECKING

from griffe import Function

from src.generated.library_docs import (
    PythonFunctionIr,
    PythonParameterIr,
)

from .docstring_extractor import extract_docstring
from .type_resolver import resolve_annotation

if TYPE_CHECKING:
    from .python_extractor import PythonExtractor


class FunctionExtractor:
    """Extracts function/method IR from Griffe Function objects."""

    def __init__(self, parent: PythonExtractor):
        self.parent = parent

    def extract(self, func: Function) -> PythonFunctionIr:
        """Extract PythonFunctionIr from a Griffe Function."""
        parameters = [self._extract_parameter(param) for param in func.parameters]
        decorators = _extract_decorators(func)

        is_async = "async" in getattr(func, "labels", set())
        is_classmethod = any("classmethod" in d for d in decorators)
        is_staticmethod = any("staticmethod" in d for d in decorators)
        is_property = any("property" in d for d in decorators)

        signature = self._build_signature(func)

        return PythonFunctionIr(
            name=func.name,
            path=func.path,
            signature=signature,
            docstring=extract_docstring(func.docstring),
            parameters=parameters,
            return_type_info=self.parent.make_type_info(func.returns),
            is_async=is_async,
            decorators=decorators,
            is_classmethod=is_classmethod,
            is_staticmethod=is_staticmethod,
            is_property=is_property,
        )

    def _extract_parameter(self, param) -> PythonParameterIr:
        """Extract a single parameter."""
        kind = _get_param_kind(param)
        default = _format_default(param.default, max_len=100)

        return PythonParameterIr(
            name=param.name,
            kind=kind,
            type_info=self.parent.make_type_info(param.annotation),
            default=default,
            description=None,
        )

    def _build_signature(self, func: Function) -> str:
        """Build a signature string for display."""
        parts = []

        if "async" in getattr(func, "labels", set()):
            parts.append("async ")

        parts.append(f"def {func.name}(")

        param_strs = [self._format_param(p) for p in func.parameters]
        params_joined = ", ".join(param_strs)

        if len(param_strs) > 3 or len(params_joined) > 60:
            # Multiline format
            parts.append("\n")
            parts.append(",\n".join(f"    {ps}" for ps in param_strs))
            parts.append("\n)")
        else:
            parts.append(params_joined)
            parts.append(")")

        if func.returns:
            return_str = resolve_annotation(func.returns, use_short_names=True)
            if return_str:
                parts.append(f" -> {return_str}")

        return "".join(parts)

    def _format_param(self, param) -> str:
        """Format a parameter for signature display."""
        kind_name = _get_param_kind_name(param)

        if kind_name == "var_positional":
            result = f"*{param.name}"
        elif kind_name == "var_keyword":
            result = f"**{param.name}"
        else:
            result = param.name

        if param.annotation:
            ann_str = resolve_annotation(param.annotation, use_short_names=True)
            if ann_str:
                result += f": {ann_str}"

        default = _format_default(param.default, max_len=50)
        if default:
            result += f" = {default}"

        return result


# -----------------------------------------------------------------------------
# Utility functions (shared)
# -----------------------------------------------------------------------------

def _extract_decorators(obj) -> list[str]:
    """Extract decorator names from a class or function."""
    decorators = []
    for decorator in obj.decorators:
        dec_str = str(decorator.value) if hasattr(decorator, "value") else str(decorator)
        if dec_str.startswith("@"):
            dec_str = dec_str[1:]
        decorators.append(dec_str)
    return decorators


def _get_param_kind_name(param) -> str:
    """Get the parameter kind name as lowercase string."""
    if hasattr(param.kind, "name"):
        return param.kind.name.lower()
    return "positional_or_keyword"


def _get_param_kind(param) -> str:
    """Map Griffe parameter kind to IR kind."""
    kind_map = {
        "positional_only": "POSITIONAL",
        "positional_or_keyword": "POSITIONAL",
        "var_positional": "VAR_POSITIONAL",
        "keyword_only": "KEYWORD_ONLY",
        "var_keyword": "VAR_KEYWORD",
    }
    return kind_map.get(_get_param_kind_name(param), "POSITIONAL")


def _format_default(default, max_len: int) -> str | None:
    """Format a default value, truncating if too long."""
    if default is None or str(default) == "":
        return None
    default_str = str(default)
    if len(default_str) > max_len:
        return default_str[: max_len - 3] + "..."
    return default_str
