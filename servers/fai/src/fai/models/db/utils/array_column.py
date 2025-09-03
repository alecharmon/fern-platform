import json
from typing import (
    Any,
    TypeVar,
)

from sqlalchemy import (
    ARRAY,
    String,
    TypeDecorator,
)
from sqlalchemy.engine import Dialect
from sqlalchemy.types import TEXT

T = TypeVar("T")


class ArrayColumn(TypeDecorator):
    """Custom array column type that works with both PostgreSQL and SQLite.

    - PostgreSQL: Uses native ARRAY type
    - SQLite: Stores as JSON string and deserializes to list
    """

    impl = TEXT
    cache_ok = True

    def __init__(self, item_type: type = String, **kwargs: Any) -> None:
        self.item_type = item_type
        super().__init__(**kwargs)

    def load_dialect_impl(self, dialect: Dialect) -> Any:
        if dialect.name == "postgresql":
            return dialect.type_descriptor(ARRAY(self.item_type))
        else:
            # For SQLite and other databases, use TEXT
            return dialect.type_descriptor(TEXT())

    def process_bind_param(self, value: list[Any] | None, dialect: Dialect) -> list[Any] | str | None:
        if value is None:
            return value

        if dialect.name == "postgresql":
            # PostgreSQL handles arrays natively
            return value
        else:
            # For SQLite, serialize to JSON
            return json.dumps(value)

    def process_result_value(self, value: list[Any] | str | None, dialect: Dialect) -> list[Any] | None:
        if value is None:
            return value

        if dialect.name == "postgresql":
            # PostgreSQL returns arrays natively
            return value if isinstance(value, list) else []
        else:
            # For SQLite, deserialize from JSON
            if isinstance(value, str):
                try:
                    return json.loads(value)
                except (json.JSONDecodeError, TypeError):
                    return []
            return value if isinstance(value, list) else []
