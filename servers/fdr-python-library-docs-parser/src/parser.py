"""Griffe-based Python package parser."""

from pathlib import Path

import griffe
from griffe import Module, Parser


class ParseError(Exception):
    """Error during parsing."""

    def __init__(self, message: str, details: dict | None = None):
        self.message = message
        self.details = details or {}
        super().__init__(message)


def parse_package(package_path: Path) -> Module:
    """
    Parse a Python package using Griffe.

    Args:
        package_path: Path to the Python package directory.

    Returns:
        Griffe Module object representing the parsed package.

    Raises:
        ParseError: If parsing fails.
    """
    try:
        # Load the package with Griffe
        module = griffe.load(
            package_path.name,
            search_paths=[package_path.parent],
            docstring_parser=Parser.google,  # Auto-handles Google, NumPy, Sphinx
            resolve_aliases=True,
            resolve_external=False,  # Don't follow external dependencies
            resolve_implicit=False,  # Don't resolve implicit re-exports
        )
        return module

    except griffe.GriffeError as e:
        raise ParseError(
            f"Failed to parse package: {package_path.name}",
            {"path": str(package_path), "error": str(e)},
        ) from e
    except Exception as e:
        raise ParseError(
            f"Unexpected error parsing package: {package_path.name}",
            {"path": str(package_path), "error": str(e), "type": type(e).__name__},
        ) from e


def get_public_members(module: Module) -> list[str]:
    """
    Get list of public member names from a module.

    Uses __all__ if defined, otherwise filters out private names.

    Args:
        module: Griffe Module object.

    Returns:
        List of public member names.
    """
    # Check for __all__
    if module.exports is not None:
        return list(module.exports)

    # Filter to non-private members
    public = []
    for name in module.members:
        if not name.startswith("_"):
            public.append(name)
    return public
