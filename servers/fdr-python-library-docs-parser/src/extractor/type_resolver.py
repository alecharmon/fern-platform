"""Type annotation resolver for cross-linking.

Resolves Griffe type annotations to fully-qualified paths for cross-linking
in generated documentation.

Note: String annotations (forward references) pass through unresolved since
they cannot be resolved without runtime evaluation.
"""

from griffe import (
    Expr,
    ExprName,
    ExprSubscript,
    ExprTuple,
    ExprBinOp,
    ExprAttribute,
)

from src.generated.library_docs import TypeInfo


def make_type_info(annotation: Expr | str | None) -> TypeInfo | None:
    """
    Create a TypeInfo object from a Griffe type annotation.

    Note: This is the standalone version. Use PythonExtractor.make_type_info()
    for internal type filtering based on loaded modules.

    Args:
        annotation: Griffe Expr or string annotation.

    Returns:
        TypeInfo with display, resolvedPath, and basePath fields.
    """
    if annotation is None:
        return None

    resolved_path = resolve_annotation(annotation)
    base_path = get_base_path(annotation)
    display = resolve_annotation(annotation, use_short_names=True)

    if not resolved_path:
        return None

    return TypeInfo(
        display=display,
        resolved_path=resolved_path,
        base_path=base_path,
    )


def get_base_path(annotation: Expr | str | None) -> str | None:
    """
    Get the base type path without generic parameters.

    Used for generating valid anchor links - we link to the base type,
    not the parameterized version (which would have brackets in the anchor).

    Args:
        annotation: Griffe Expr or string annotation.

    Returns:
        Base type path (e.g., "typing.Optional" from "typing.Optional[int]"),
        or None for unions/built-ins that can't be linked.

    Examples:
        ExprSubscript(Optional[int]) -> "typing.Optional"
        ExprName(Tensor) -> "torch.Tensor"
        ExprBinOp(float | None) -> None (unions don't have single base)
    """
    if annotation is None:
        return None

    if isinstance(annotation, str):
        bracket_idx = annotation.find("[")
        return annotation[:bracket_idx] if bracket_idx >= 0 else annotation

    return _get_base_path_expr(annotation)


def _get_base_path_expr(expr: Expr) -> str | None:
    """Get base path from a Griffe expression."""
    if isinstance(expr, ExprSubscript):
        return _get_base_path_expr(expr.left)

    if isinstance(expr, ExprName):
        return _safe_canonical_path(expr)

    if isinstance(expr, ExprAttribute):
        return _safe_canonical_path(expr)

    if isinstance(expr, ExprBinOp):
        # Union type (X | Y) - no single base path
        return None

    return None


def resolve_annotation(annotation: Expr | str | None, use_short_names: bool = False) -> str | None:
    """
    Resolve a type annotation to a string.

    Args:
        annotation: Griffe Expr or string annotation.
        use_short_names: If True, use short type names (e.g., "NotRequired").
                         If False, use canonical paths (e.g., "typing.NotRequired").

    Returns:
        The annotation string, or None if no annotation.

    Examples (use_short_names=False):
        "BatchedDataDict" -> "nemo_rl.distributed.batched_data_dict.BatchedDataDict"
        "dict[str, BatchedDataDict]" -> "dict[str, nemo_rl.distributed.batched_data_dict.BatchedDataDict]"

    Examples (use_short_names=True):
        "typing.NotRequired[nemo_rl.grpo.Config]" -> "NotRequired[Config]"
    """
    if annotation is None:
        return None

    # String annotations (forward references) pass through unresolved
    if isinstance(annotation, str):
        return annotation

    return _resolve_expr(annotation, use_short_names)


def _resolve_expr(expr, use_short_names: bool = False) -> str:
    """Recursively resolve an expression to a string."""
    # Handle string inputs (can come from ExprAttribute.first or ExprSubscript.left/slice)
    if isinstance(expr, str):
        return expr

    # Handle None
    if expr is None:
        return ""

    if isinstance(expr, ExprName):
        if use_short_names:
            return expr.name
        canonical = _safe_canonical_path(expr)
        return canonical if canonical else expr.name

    if isinstance(expr, ExprAttribute):
        if use_short_names:
            return str(expr.last) if expr.last else ""
        canonical = _safe_canonical_path(expr)
        if canonical:
            return canonical
        left = _resolve_expr(expr.first, use_short_names)
        return f"{left}.{expr.last}"

    if isinstance(expr, ExprSubscript):
        left = _resolve_expr(expr.left, use_short_names)

        if isinstance(expr.slice, ExprTuple):
            args = ", ".join(_resolve_expr(item, use_short_names) for item in expr.slice.elements)
        else:
            args = _resolve_expr(expr.slice, use_short_names)

        return f"{left}[{args}]"

    if isinstance(expr, ExprBinOp):
        left = _resolve_expr(expr.left, use_short_names)
        right = _resolve_expr(expr.right, use_short_names)
        return f"{left} | {right}"

    if isinstance(expr, ExprTuple):
        elements = ", ".join(_resolve_expr(item, use_short_names) for item in expr.elements)
        return f"({elements})"

    # Fallback for any other Expr type - str() gives the code representation
    return str(expr)


def _safe_canonical_path(expr: Expr) -> str | None:
    """
    Safely get canonical_path from an expression.

    The canonical_path property can raise exceptions when resolution fails
    (e.g., for external/unresolvable types), so we wrap access in try/except.
    """
    try:
        return getattr(expr, "canonical_path", None)
    except Exception:
        return None
