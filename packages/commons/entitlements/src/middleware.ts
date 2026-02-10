import type { EntitlementsChecker } from "./check";
import type { EntitlementKey } from "./types";

/**
 * Error thrown when an entitlement check fails.
 */
export class EntitlementDeniedError extends Error {
    public readonly statusCode = 403;

    constructor(reason: string) {
        super(reason);
        this.name = "EntitlementDeniedError";
    }
}

/**
 * Next.js helper — gates a server action or route handler behind an entitlement check.
 * Throws EntitlementDeniedError (403) if denied.
 */
export async function withEntitlement<T>(
    checker: EntitlementsChecker,
    orgId: string,
    key: EntitlementKey,
    fn: () => Promise<T>
): Promise<T> {
    const result = await checker.check(orgId, key);

    if (result.entitled === false) {
        throw new EntitlementDeniedError(result.reason);
    }

    return fn();
}
