import { EVERYONE_ROLE } from "@fern-api/docs-utils";

/**
 * Result of processing all role sets for a single slug
 */
export interface RoleSetProcessingResult {
    /** Number of role sets that succeeded (2xx response) */
    succeeded: number;
    /** Number of role sets that returned 404 (expected for role-restricted pages) */
    skipped: number;
    /** Errors from role sets that failed with non-404 errors or network errors */
    errors: Array<{ roleSet: string[]; error: Error }>;
}

/**
 * A fetch function that returns a Response-like object with ok and status.
 */
export interface FetchForRoleSet {
    (roleSet: string[]): Promise<{ ok: boolean; status: number }>;
}

/**
 * Processes all role sets for a single slug independently.
 *
 * Key behaviors:
 * - Each role set is attempted independently — failure of one does NOT prevent others.
 * - A 404 response is expected for role-restricted pages where the role doesn't have access.
 *   These are counted as "skipped" (not errors).
 * - Non-404 failures (e.g. 500, network errors) are collected as errors.
 * - Returns a result that the caller can use to decide whether to retry.
 *
 * @param roleSets - The role set combinations to attempt (e.g. [["everyone"], ["everyone", "europe"]])
 * @param fetchForRoleSet - A function that fetches the page for a given role set
 * @returns Processing result with succeeded/skipped/error counts
 */
export async function processRoleSets(
    roleSets: string[][],
    fetchForRoleSet: FetchForRoleSet
): Promise<RoleSetProcessingResult> {
    let succeeded = 0;
    let skipped = 0;
    const errors: Array<{ roleSet: string[]; error: Error }> = [];

    for (const roleSet of roleSets) {
        try {
            const res = await fetchForRoleSet(roleSet);

            if (res.ok) {
                succeeded++;
            } else if (res.status === 404) {
                // 404 is expected for role-restricted pages where this role set
                // doesn't have access. This is not an error — just skip.
                skipped++;
            } else {
                errors.push({
                    roleSet,
                    error: new Error(
                        `Failed to revalidate with roles ${roleSet.join(",")}. Status code: ${res.status}`
                    )
                });
            }
        } catch (e) {
            errors.push({
                roleSet,
                error: e instanceof Error ? e : new Error(String(e))
            });
        }
    }

    return { succeeded, skipped, errors };
}

/**
 * Determines whether a role set processing result should be considered a failure
 * that warrants retrying the entire slug.
 *
 * A slug should be retried only if:
 * - There were non-404 errors AND no role set succeeded
 *
 * If at least one role set succeeded, or all failures were 404s (skipped),
 * the slug is considered successful (or at least not worth retrying).
 */
export function shouldRetrySlug(result: RoleSetProcessingResult): boolean {
    return result.succeeded === 0 && result.skipped === 0 && result.errors.length > 0;
}

/**
 * Builds a roles header string from a role set.
 * Filters out EVERYONE_ROLE (which is always added by middleware)
 * and joins remaining roles with pipe delimiter.
 */
export function buildRolesHeader(roleSet: string[]): string {
    const headerRoles = roleSet.filter((r) => r !== EVERYONE_ROLE).join("|");
    return headerRoles ? `,roles:${headerRoles}` : "";
}
