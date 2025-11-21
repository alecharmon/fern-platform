from dataclasses import (
    dataclass,
    field,
)
from typing import Any


@dataclass
class QueryFilters:
    facet_filters: list[dict[str, Any]] = field(default_factory=list)
    exploded_roles: list[str] = field(default_factory=list)
    document_ids_to_ignore: list[str] = field(default_factory=list)
    urls_to_ignore: list[str] = field(default_factory=list)
    document_urls: list[str] | None = None
    user_is_authed: bool = False
