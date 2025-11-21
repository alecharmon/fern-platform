import pytest

from src.auth.roles import create_exploded_roles


class TestRoleExplosion:
    def test_empty_roles(self):
        result = create_exploded_roles([])
        assert result == []

    def test_single_role(self):
        result = create_exploded_roles(["admin"])
        assert result == ["admin"]

    def test_two_roles(self):
        result = create_exploded_roles(["admin", "user"])
        assert set(result) == {"admin", "user", "admin&user"}

    def test_three_roles(self):
        result = create_exploded_roles(["a", "b", "c"])
        assert set(result) == {"a", "b", "c", "a&b", "a&c", "b&c", "a&b&c"}

    def test_duplicate_roles_removed(self):
        result = create_exploded_roles(["admin", "admin", "user"])
        assert set(result) == {"admin", "user", "admin&user"}

    def test_roles_are_sorted_in_combinations(self):
        result = create_exploded_roles(["z", "a"])
        assert "a&z" in result

    def test_four_roles(self):
        result = create_exploded_roles(["a", "b", "c", "d"])
        assert len(result) == 15
        assert "a&b&c&d" in result
