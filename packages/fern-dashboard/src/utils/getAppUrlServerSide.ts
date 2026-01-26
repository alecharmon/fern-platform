import { headers } from "next/headers";
import { cache } from "react";

/**
 * Gets the application URL from request headers.
 * Uses React.cache() to deduplicate header reads within a single request tree.
 */
export const getAppUrlServerSide = cache(async () => {
    const headersList = await headers();

    const host = headersList.get("host");
    if (host == null) {
        throw new Error("host header is not present");
    }

    const protocol = headersList.get("x-forwarded-proto") ?? "https";

    return `${protocol}://${host}`;
});
