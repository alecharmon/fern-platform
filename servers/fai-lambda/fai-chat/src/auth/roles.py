DELIMITER = "&"


def create_exploded_roles(roleset: list[str]) -> list[str]:
    src = list(set(roleset))
    n = len(src)
    out: list[str] = []

    def backtrack(start: int, path: list[str]) -> None:
        combo = sorted(path)
        if len(combo) > 0:
            out.append(DELIMITER.join(combo))

        for i in range(start, n):
            role = src[i]
            if role is not None:
                path.append(role)
                backtrack(i + 1, path)
                path.pop()

    backtrack(0, [])
    return out
