import { EVERYONE_ROLE } from "@fern-api/docs-utils";

/**
 * Builds all non-empty subset combinations of the given roles, each prefixed with EVERYONE_ROLE.
 * Also includes a base set of just [EVERYONE_ROLE].
 *
 * For example, given roles ["admin", "developer", "viewer"], this returns:
 * - [EVERYONE_ROLE]                                    (base)
 * - [EVERYONE_ROLE, "admin"]                           (single)
 * - [EVERYONE_ROLE, "developer"]                       (single)
 * - [EVERYONE_ROLE, "viewer"]                          (single)
 * - [EVERYONE_ROLE, "admin", "developer"]              (pair)
 * - [EVERYONE_ROLE, "admin", "viewer"]                 (pair)
 * - [EVERYONE_ROLE, "developer", "viewer"]             (pair)
 * - [EVERYONE_ROLE, "admin", "developer", "viewer"]    (all)
 *
 * The EVERYONE_ROLE is always excluded from the input roles before generating combinations.
 * Roles within each subset are alpha-sorted for canonical ordering.
 */
export function buildRoleSets(roles: Iterable<string>): string[][] {
    const filtered: string[] = [];
    for (const role of roles) {
        if (role !== EVERYONE_ROLE) {
            filtered.push(role);
        }
    }
    filtered.sort();

    const roleSets: string[][] = [[EVERYONE_ROLE]];

    // Generate all non-empty subsets (power set minus empty set)
    const n = filtered.length;
    for (let mask = 1; mask < 1 << n; mask++) {
        const subset: string[] = [EVERYONE_ROLE];
        for (let i = 0; i < n; i++) {
            if (mask & (1 << i)) {
                subset.push(filtered[i]!);
            }
        }
        roleSets.push(subset);
    }

    return roleSets;
}
