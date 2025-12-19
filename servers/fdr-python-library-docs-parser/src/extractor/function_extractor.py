"""Extract PythonFunctionIr from Griffe functions."""

from griffe import Function

from src.generated.library_docs import (
    PythonFunctionIr,
    PythonParameterIr,
)

from .docstring_extractor import extract_docstring


def extract_function(func: Function) -> PythonFunctionIr:
    """
    Extract PythonFunctionIr from a Griffe Function.

    Args:
        func: Griffe Function object.

    Returns:
        PythonFunctionIr with all function information.
    """
    # Extract parameters
    parameters = [_extract_parameter(param) for param in func.parameters]

    # Extract decorators
    decorators = _extract_decorators(func)

    # Determine function properties
    is_async = hasattr(func, "labels") and "async" in func.labels
    is_classmethod = any("classmethod" in d for d in decorators)
    is_staticmethod = any("staticmethod" in d for d in decorators)
    is_property = any("property" in d for d in decorators)

    # Build signature
    signature = _build_signature(func)

    # Extract return type
    return_type = _format_annotation(func.returns) if func.returns else None

    return PythonFunctionIr(
        name=func.name,
        path=func.path,
        signature=signature,
        docstring=extract_docstring(func.docstring),
        parameters=parameters,
        return_type=return_type,
        is_async=is_async,
        decorators=decorators,
        is_classmethod=is_classmethod,
        is_staticmethod=is_staticmethod,
        is_property=is_property,
    )


def _extract_parameter(param) -> PythonParameterIr:
    """Extract a single parameter."""
    # Map Griffe parameter kind to string literals
    kind_map = {
        "positional_only": "POSITIONAL",
        "positional_or_keyword": "POSITIONAL",
        "var_positional": "VAR_POSITIONAL",
        "keyword_only": "KEYWORD_ONLY",
        "var_keyword": "VAR_KEYWORD",
    }

    kind_name = param.kind.name.lower() if hasattr(param.kind, "name") else "positional_or_keyword"
    kind = kind_map.get(kind_name, "POSITIONAL")

    # Format default value
    default = None
    if param.default is not None and str(param.default) != "":
        default_str = str(param.default)
        # Truncate very long defaults
        if len(default_str) > 100:
            default_str = default_str[:97] + "..."
        default = default_str

    return PythonParameterIr(
        name=param.name,
        kind=kind,
        type=_format_annotation(param.annotation) if param.annotation else None,
        default=default,
        description=None,  # Filled from docstring later if needed
    )


def _extract_decorators(func: Function) -> list[str]:
    """Extract decorator names from a function."""
    decorators = []
    for decorator in func.decorators:
        dec_str = str(decorator.value) if hasattr(decorator, "value") else str(decorator)
        # Clean up the decorator string
        if dec_str.startswith("@"):
            dec_str = dec_str[1:]
        decorators.append(dec_str)
    return decorators


def _format_annotation(annotation) -> str:
    """Format a type annotation as a string."""
    if annotation is None:
        return ""

    # Handle string annotations directly
    if isinstance(annotation, str):
        return annotation

    # Try to get a clean string representation
    ann_str = str(annotation)

    # Clean up common patterns
    if ann_str.startswith("<"):
        # Handle <class 'type'> patterns
        if "'" in ann_str:
            return ann_str.split("'")[1].split(".")[-1]
        return ann_str

    return ann_str


def _build_signature(func: Function) -> str:
    """Build a signature string for display."""
    parts = []

    # Add async prefix if needed
    if hasattr(func, "labels") and "async" in func.labels:
        parts.append("async ")

    parts.append(f"def {func.name}(")

    # Format parameters
    param_strs = []
    for param in func.parameters:
        param_str = _format_param_for_signature(param)
        param_strs.append(param_str)

    # Decide on multiline or single line
    params_joined = ", ".join(param_strs)
    if len(param_strs) > 3 or len(params_joined) > 60:
        # Multiline format
        parts.append("\n")
        for i, ps in enumerate(param_strs):
            parts.append(f"    {ps}")
            if i < len(param_strs) - 1:
                parts.append(",\n")
            else:
                parts.append("\n")
        parts.append(")")
    else:
        parts.append(params_joined)
        parts.append(")")

    # Add return type
    if func.returns:
        return_str = _format_annotation(func.returns)
        if return_str:
            parts.append(f" -> {return_str}")

    return "".join(parts)


def _format_param_for_signature(param) -> str:
    """Format a parameter for the signature display."""
    parts = []

    # Handle *args and **kwargs
    kind_name = param.kind.name.lower() if hasattr(param.kind, "name") else ""
    if kind_name == "var_positional":
        parts.append(f"*{param.name}")
    elif kind_name == "var_keyword":
        parts.append(f"**{param.name}")
    else:
        parts.append(param.name)

    result = parts[0]

    # Add type annotation
    if param.annotation:
        ann_str = _format_annotation(param.annotation)
        if ann_str:
            result += f": {ann_str}"

    # Add default value
    if param.default is not None and str(param.default) != "":
        default_str = str(param.default)
        if len(default_str) > 50:
            default_str = default_str[:47] + "..."
        result += f" = {default_str}"

    return result
