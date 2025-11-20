
from src.retrieval.filters import QueryFilters
from src.retrieval.turbopuffer_query_filters import (
    EVERYONE_ROLE,
    build_inclusion_filters,
    build_negation_filters,
    build_turbopuffer_filters,
)


class TestHelperFunctions:
    def test_build_negation_filters_empty(self):
        result = build_negation_filters("id", [])
        assert result == []

    def test_build_negation_filters_single_value(self):
        result = build_negation_filters("id", ["doc123"])
        assert result == [("id", "NotEq", "doc123")]

    def test_build_negation_filters_multiple_values(self):
        result = build_negation_filters("url", ["/page1", "/page2", "/page3"])
        assert result == [
            ("url", "NotEq", "/page1"),
            ("url", "NotEq", "/page2"),
            ("url", "NotEq", "/page3"),
        ]

    def test_build_inclusion_filters_empty(self):
        result = build_inclusion_filters("url", [])
        assert result == []

    def test_build_inclusion_filters_single_value(self):
        result = build_inclusion_filters("url", ["/specific-page"])
        assert result == [("url", "Eq", "/specific-page")]

    def test_build_inclusion_filters_multiple_values(self):
        result = build_inclusion_filters("url", ["/page1", "/page2"])
        assert result == [
            ("url", "Eq", "/page1"),
            ("url", "Eq", "/page2"),
        ]


class TestBuildTurbopufferFilters:
    def test_empty_filters_returns_and_with_role_filter(self):
        filters = QueryFilters()
        result = build_turbopuffer_filters(filters)

        assert result == (
            "And",
            [
                ("Or", [("roles", "Contains", EVERYONE_ROLE), ("roles", "Eq", None)]),
                ("authed", "Eq", False),
            ],
        )

    def test_user_is_authed_true_excludes_auth_filter(self):
        filters = QueryFilters(user_is_authed=True)
        result = build_turbopuffer_filters(filters)

        assert result == (
            "And",
            [
                ("Or", [("roles", "Contains", EVERYONE_ROLE), ("roles", "Eq", None)]),
            ],
        )

    def test_version_facet_filter_case_variations(self):
        filters = QueryFilters(
            facet_filters=[{"field": "version.title", "value": "v1"}],
        )
        result = build_turbopuffer_filters(filters)

        assert result == (
            "And",
            [
                (
                    "Or",
                    [
                        ("version", "Eq", "v1"),
                        ("version", "Eq", "V1"),
                        ("version", "Eq", "v1"),
                        ("version", "Eq", None),
                    ],
                ),
                ("Or", [("roles", "Contains", EVERYONE_ROLE), ("roles", "Eq", None)]),
                ("authed", "Eq", False),
            ],
        )

    def test_multiple_version_filters(self):
        filters = QueryFilters(
            facet_filters=[
                {"field": "version.title", "value": "v1"},
                {"field": "version.title", "value": "v2"},
            ],
        )
        result = build_turbopuffer_filters(filters)

        assert result[0] == "And"
        version_filters = [f for f in result[1] if isinstance(f, tuple) and f[0] == "Or" and "version" in str(f)]
        assert len(version_filters) == 2

    def test_product_facet_filter_with_null(self):
        filters = QueryFilters(
            facet_filters=[{"field": "product.title", "value": "api"}],
        )
        result = build_turbopuffer_filters(filters)

        assert result == (
            "And",
            [
                (
                    "Or",
                    [
                        ("product", "Eq", "api"),
                        ("product", "Eq", None),
                    ],
                ),
                ("Or", [("roles", "Contains", EVERYONE_ROLE), ("roles", "Eq", None)]),
                ("authed", "Eq", False),
            ],
        )

    def test_multiple_product_filters(self):
        filters = QueryFilters(
            facet_filters=[
                {"field": "product.title", "value": "api"},
                {"field": "product.title", "value": "sdk"},
            ],
        )
        result = build_turbopuffer_filters(filters)

        assert result[0] == "And"
        product_filters = [f for f in result[1] if isinstance(f, tuple) and f[0] == "Or" and "product" in str(f)]
        assert len(product_filters) == 2

    def test_exploded_roles_includes_everyone(self):
        filters = QueryFilters(
            exploded_roles=["admin", "developer"],
        )
        result = build_turbopuffer_filters(filters)

        role_filter = [f for f in result[1] if isinstance(f, tuple) and "roles" in str(f)][0]
        assert role_filter == (
            "Or",
            [
                ("roles", "Contains", "admin"),
                ("roles", "Contains", "developer"),
                ("roles", "Contains", EVERYONE_ROLE),
                ("roles", "Eq", None),
            ],
        )

    def test_exploded_roles_already_has_everyone(self):
        filters = QueryFilters(
            exploded_roles=["admin", EVERYONE_ROLE],
        )
        result = build_turbopuffer_filters(filters)

        role_filter = [f for f in result[1] if isinstance(f, tuple) and "roles" in str(f)][0]
        assert role_filter == (
            "Or",
            [
                ("roles", "Contains", "admin"),
                ("roles", "Contains", EVERYONE_ROLE),
                ("roles", "Eq", None),
            ],
        )

    def test_document_ids_to_ignore(self):
        filters = QueryFilters(
            document_ids_to_ignore=["doc1", "doc2"],
        )
        result = build_turbopuffer_filters(filters)

        assert ("id", "NotEq", "doc1") in result[1]
        assert ("id", "NotEq", "doc2") in result[1]

    def test_urls_to_ignore(self):
        filters = QueryFilters(
            urls_to_ignore=["/page1", "/page2"],
        )
        result = build_turbopuffer_filters(filters)

        assert ("url", "NotEq", "/page1") in result[1]
        assert ("url", "NotEq", "/page2") in result[1]

    def test_document_urls_inclusion(self):
        filters = QueryFilters(
            document_urls=["/specific-page1", "/specific-page2"],
        )
        result = build_turbopuffer_filters(filters)

        assert result[0] == "And"
        or_filter = result[1][0]
        assert or_filter[0] == "Or"
        assert ("url", "Eq", "/specific-page1") in or_filter[1]
        assert ("url", "Eq", "/specific-page2") in or_filter[1]

    def test_document_urls_changes_filter_structure(self):
        filters = QueryFilters(
            document_urls=["/page1"],
            document_ids_to_ignore=["doc1"],
        )
        result = build_turbopuffer_filters(filters)

        assert result[0] == "And"
        or_filter = result[1][0]
        assert or_filter[0] == "Or"
        assert ("url", "Eq", "/page1") in or_filter[1]
        result_str = str(result)
        assert "doc1" not in result_str

    def test_complex_combined_filters(self):
        filters = QueryFilters(
            facet_filters=[
                {"field": "version.title", "value": "v1"},
                {"field": "product.title", "value": "api"},
            ],
            exploded_roles=["developer"],
            document_ids_to_ignore=["doc1"],
            urls_to_ignore=["/old-page"],
            user_is_authed=False,
        )
        result = build_turbopuffer_filters(filters)

        assert result[0] == "And"
        filters_list = result[1]

        version_filter = [f for f in filters_list if isinstance(f, tuple) and "version" in str(f)][0]
        assert version_filter[0] == "Or"

        product_filter = [f for f in filters_list if isinstance(f, tuple) and "product" in str(f)][0]
        assert product_filter[0] == "Or"

        role_filter = [f for f in filters_list if isinstance(f, tuple) and "roles" in str(f)][0]
        assert ("roles", "Contains", "developer") in role_filter[1]
        assert ("roles", "Contains", EVERYONE_ROLE) in role_filter[1]

        assert ("id", "NotEq", "doc1") in filters_list
        assert ("url", "NotEq", "/old-page") in filters_list
        assert ("authed", "Eq", False) in filters_list

    def test_unknown_facet_field_ignored(self):
        filters = QueryFilters(
            facet_filters=[{"field": "unknown.field", "value": "something"}],
        )
        result = build_turbopuffer_filters(filters)

        assert "unknown" not in str(result)
