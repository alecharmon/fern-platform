from typing import Any


def build_filters(
    filters: list[dict[str, str]] | None = None,
    exploded_roles: list[str] | None = None,
) -> Any | None:
    exploded_roles = exploded_roles or []
    filters = filters or []

    version_facet_filters = [f for f in filters if f.get("facet") == "version.title"]
    product_facet_filters = [f for f in filters if f.get("facet") == "product.title"]

    version_filters: list[Any] = []
    for f in version_facet_filters:
        if "value" in f:
            value = f["value"]
            version_filters.append(
                [
                    "Or",
                    [
                        ["version", "Eq", value],
                        ["version", "Eq", value.upper()],
                        ["version", "Eq", value.lower()],
                        ["version", "Eq", None],
                    ],
                ]
            )

    product_filters: list[Any] = []
    for f in product_facet_filters:
        if "value" in f:
            product_filters.append(
                [
                    "Or",
                    [
                        ["product", "Eq", f["value"]],
                        ["product", "Eq", None],
                    ],
                ]
            )

    role_filters: Any = None
    if exploded_roles:
        role_conditions: list[Any] = [["roles", "Contains", role] for role in exploded_roles]
        role_conditions.append(["roles", "Eq", None])
        role_filters = ["Or", role_conditions]

    filter_components: list[Any] = []

    filter_components.extend(version_filters)
    filter_components.extend(product_filters)

    if role_filters:
        filter_components.append(role_filters)

    if not filter_components:
        return None
    elif len(filter_components) == 1:
        return filter_components[0]
    else:
        return ["And", filter_components]
