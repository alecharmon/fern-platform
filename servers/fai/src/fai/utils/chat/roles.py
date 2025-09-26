from itertools import combinations


def create_delimited_role_combinations(roleset: list[str], delimiter: str = "&") -> list[str]:
    src = list(set(filter(None, roleset)))
    n = len(src)
    out: list[str] = []

    for r in range(1, n + 1):
        for combo in combinations(src, r):
            sorted_combo = sorted(combo)
            out.append(delimiter.join(sorted_combo))

    return out
