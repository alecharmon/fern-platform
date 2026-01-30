import "server-only";

import { headers } from "next/headers";

/**
 * Gets the current path from the x-current-path header set by middleware.
 * Returns undefined if the header is not available.
 */
export async function getCurrentPath(): Promise<string | undefined> {
    try {
        const headersList = await headers();
        return headersList.get("x-current-path") ?? undefined;
    } catch {
        return undefined;
    }
}
