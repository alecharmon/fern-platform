from typing import Literal

from turbopuffer.types.custom import Filter as TurbopufferFilter

from .filters import QueryFilters

__all__ = ["TurbopufferFilter", "build_turbopuffer_filters", "build_negation_filters", "build_inclusion_filters"]

EVERYONE_ROLE = "everyone"


def build_negation_filters(field: str, values: list[str]) -> list[tuple[str, Literal["NotEq"], str]]:
    return [(field, "NotEq", v) for v in values]


def build_inclusion_filters(field: str, values: list[str]) -> list[tuple[str, Literal["Eq"], str]]:
    return [(field, "Eq", v) for v in values]


def build_turbopuffer_filters(filters: QueryFilters) -> TurbopufferFilter | None:
    version_facet_filters = [f for f in filters.facet_filters if f.get("field") == "version.title"]
    product_facet_filters = [f for f in filters.facet_filters if f.get("field") == "product.title"]

    document_id_negation_filters = build_negation_filters("id", filters.document_ids_to_ignore)
    url_negation_filters = build_negation_filters("url", filters.urls_to_ignore)

    url_inclusion_filters = build_inclusion_filters("url", filters.document_urls) if filters.document_urls else []

    version_filters: list[TurbopufferFilter] = []
    for f in version_facet_filters:
        value = f.get("value", "")
        version_filter_group: TurbopufferFilter = (
            "Or",
            [
                ("version", "Eq", value),
                ("version", "Eq", value.upper()),
                ("version", "Eq", value.lower()),
                ("version", "Eq", None),
            ],
        )
        version_filters.append(version_filter_group)

    product_filters: list[TurbopufferFilter] = []
    for f in product_facet_filters:
        value = f.get("value", "")
        product_filter_group: TurbopufferFilter = (
            "Or",
            [
                ("product", "Eq", value),
                ("product", "Eq", None),
            ],
        )
        product_filters.append(product_filter_group)

    has_document_constraints = len(url_inclusion_filters) > 0

    roles_to_filter = (
        filters.exploded_roles if EVERYONE_ROLE in filters.exploded_roles else [*filters.exploded_roles, EVERYONE_ROLE]
    )
    role_filters: TurbopufferFilter = (
        "Or",
        [*[("roles", "Contains", role) for role in roles_to_filter], ("roles", "Eq", None)],
    )

    auth_filters: list[TurbopufferFilter] = [] if filters.user_is_authed else [("authed", "Eq", False)]

    result: TurbopufferFilter
    if has_document_constraints:
        result = (
            "And",
            [("Or", url_inclusion_filters), *version_filters, *product_filters, role_filters, *auth_filters],
        )
    else:
        result = (
            "And",
            [
                *version_filters,
                *product_filters,
                role_filters,
                *document_id_negation_filters,
                *url_negation_filters,
                *auth_filters,
            ],
        )

    return result
