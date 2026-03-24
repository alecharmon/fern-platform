from itertools import combinations

ROLE_DELIMITER = "&"


def create_exploded_roles(roleset: list[str]) -> list[str]:
    """Create all role combination facets from the user's roles.

    For a user with roles ["admin", "developer"], generates:
    - "admin" (single role)
    - "developer" (single role)
    - "admin&developer" (combined facet matching AND requirement)

    This allows matching against indexed role facets that may require
    multiple roles simultaneously (AND requirement stored as "admin&developer").
    """
    if not roleset:
        return []

    unique_roles = sorted(set(roleset))
    facets: set[str] = set()

    for size in range(1, len(unique_roles) + 1):
        for combo in combinations(unique_roles, size):
            facets.add(ROLE_DELIMITER.join(combo))

    return sorted(facets)
