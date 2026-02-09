from src.auth.roles import create_exploded_roles


class TestRoleExplosion:
    def test_empty_roles(self) -> None:
        result = create_exploded_roles([])
        assert result == []

    def test_single_role(self) -> None:
        result = create_exploded_roles(["admin"])
        assert result == ["admin"]

    def test_two_roles(self) -> None:
        result = create_exploded_roles(["admin", "user"])
        assert set(result) == {"admin", "user"}

    def test_three_roles(self) -> None:
        result = create_exploded_roles(["a", "b", "c"])
        assert set(result) == {"a", "b", "c"}

    def test_duplicate_roles_removed(self) -> None:
        result = create_exploded_roles(["admin", "admin", "user"])
        assert set(result) == {"admin", "user"}

    def test_roles_are_sorted(self) -> None:
        result = create_exploded_roles(["z", "a"])
        assert result == ["a", "z"]

    def test_four_roles(self) -> None:
        result = create_exploded_roles(["a", "b", "c", "d"])
        assert len(result) == 4
        assert result == ["a", "b", "c", "d"]
