from collections.abc import Callable
from typing import Any, Protocol

from oculus.framework.models import Question


class Generator(Protocol):
    """Protocol for question generators."""

    def generate(self, docs_definition: dict[str, Any], domain: str) -> list[Question]:
        """Generate questions from a docs definition.

        Args:
            docs_definition: The documentation definition from FDR
            domain: The domain being evaluated

        Returns:
            List of Question objects
        """
        ...


class GeneratorRegistry:
    """Registry for managing question generators."""

    def __init__(self) -> None:
        self._generators: dict[str, Callable[[dict[str, Any], str], list[Question]]] = {}

    def register(
        self,
        name: str,
        generator_fn: Callable[[dict[str, Any], str], list[Question]],
    ) -> None:
        """Register a generator function.

        Args:
            name: Name of the generator (e.g., 'openapi')
            generator_fn: Function that takes docs_definition and domain, returns list of Questions
        """
        self._generators[name] = generator_fn

    def get(self, name: str) -> Callable[[dict[str, Any], str], list[Question]] | None:
        """Get a generator by name."""
        return self._generators.get(name)

    def list_available(self) -> list[str]:
        """List all available generator names."""
        return list(self._generators.keys())


# Global registry instance
_registry = GeneratorRegistry()


def register_generator(
    name: str,
) -> Callable[[Callable[[dict[str, Any], str], list[Question]]], Callable[[dict[str, Any], str], list[Question]]]:
    """Decorator to register a generator function.

    Example:
        @register_generator("openapi")
        def generate_openapi_questions(docs_definition: dict, domain: str) -> list[Question]:
            ...
    """

    def decorator(
        fn: Callable[[dict[str, Any], str], list[Question]],
    ) -> Callable[[dict[str, Any], str], list[Question]]:
        _registry.register(name, fn)
        return fn

    return decorator


def get_generator(name: str) -> Callable[[dict[str, Any], str], list[Question]] | None:
    """Get a generator function by name."""
    return _registry.get(name)


def list_generators() -> list[str]:
    """List all registered generators."""
    return _registry.list_available()
