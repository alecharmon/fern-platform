from src.auth.roles import create_exploded_roles


class TestRoleExplosion:
    def test_empty_roles(self) -> None:
        result = create_exploded_roles([])
        assert result == []

    def test_single_role(self) -> None:
        result = create_exploded_roles(["admin"])
        assert result == ["admin"]

    def test_two_roles_generates_facets(self) -> None:
        result = create_exploded_roles(["admin", "user"])
        assert set(result) == {"admin", "admin&user", "user"}

    def test_three_roles_generates_all_combinations(self) -> None:
        result = create_exploded_roles(["a", "b", "c"])
        assert set(result) == {"a", "b", "c", "a&b", "a&c", "b&c", "a&b&c"}

    def test_duplicate_roles_removed(self) -> None:
        result = create_exploded_roles(["admin", "admin", "user"])
        assert set(result) == {"admin", "admin&user", "user"}

    def test_roles_are_sorted(self) -> None:
        result = create_exploded_roles(["z", "a"])
        # Individual facets and combined facets are sorted
        assert "a" in result
        assert "z" in result
        assert "a&z" in result

    def test_four_roles(self) -> None:
        result = create_exploded_roles(["a", "b", "c", "d"])
        # 4 singles + 6 pairs + 4 triples + 1 quad = 15 facets
        assert len(result) == 15
        assert "a" in result
        assert "a&b" in result
        assert "a&b&c" in result
        assert "a&b&c&d" in result

    def test_facets_use_ampersand_delimiter(self) -> None:
        result = create_exploded_roles(["admin", "developer"])
        assert "admin&developer" in result

    def test_unsorted_input_produces_sorted_facets(self) -> None:
        result = create_exploded_roles(["developer", "admin"])
        # Facet should be sorted alphabetically
        assert "admin&developer" in result
        assert "developer&admin" not in result
