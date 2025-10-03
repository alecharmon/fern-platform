const DELIMITER = "&";

export function createDelimitedRolesetString(roleset: string[]): string {
    const sortedRoleset = [...roleset].sort();
    return sortedRoleset.join(DELIMITER);
}

export function createDelimitedRolesetCombinations({ roleset }: { roleset: string[] }): string[] {
    const src = Array.from(new Set(roleset));
    const n = src.length;
    const out: string[] = [];

    function backtrack(start: number, path: string[]) {
        const combo = [...path].sort();
        if (combo.length > 0) {
            out.push(combo.join(DELIMITER));
        }

        for (let i = start; i < n; i++) {
            const role = src[i];
            if (role != null) {
                path.push(role);
                backtrack(i + 1, path);
                path.pop();
            }
        }
    }

    backtrack(0, []);
    return out;
}
