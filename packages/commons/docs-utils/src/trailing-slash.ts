function isTruthy(value: string | undefined) {
    return value != null && ["true", "1"].includes(value.trim().toLowerCase());
}

/**
 * Global runtime override for the trailing slash setting.
 * This is set by the client-side TrailingSlash provider component
 * which hydrates it from the per-domain edge flag.
 * When set to a boolean, it takes precedence over the env var.
 */
let trailingSlashOverride: boolean | undefined;

/**
 * Set the global trailing slash override. Called by the client-side
 * TrailingSlash provider to propagate the per-domain setting.
 */
export function setTrailingSlashOverride(enabled: boolean): void {
    trailingSlashOverride = enabled;
}

export const isTrailingSlashEnabled = (): boolean => {
    if (trailingSlashOverride != null) {
        return trailingSlashOverride;
    }
    return isTruthy(process.env.NEXT_PUBLIC_TRAILING_SLASH);
};

export const addTrailingSlash = (pathname: string): string => {
    return pathname.endsWith("/") ? pathname : `${pathname}/`;
};

export const removeTrailingSlash = (pathname: string): string => {
    return pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
};

/**
 * Conforms the trailing slash of a pathname based on the trailing slash setting.
 *
 * @param pathname - The pathname to conform.
 * @param enabled - Optional explicit override for whether trailing slash is enabled.
 *                  When provided, this takes precedence over the env var.
 *                  This is used in the middleware where the per-domain edge flag is available.
 */
export function conformTrailingSlash(pathname: string, enabled?: boolean): string {
    // root pathname should always be `/` regardless of trailing slash setting
    // because empty string is not a valid URL pathname
    if (pathname === "/" || pathname === "") {
        return "/";
    }

    // Check if the pathname is a URL
    if (pathname.startsWith("http://") || pathname.startsWith("https://")) {
        try {
            // conform pathname of fully qualified URLs
            const url = new URL(pathname);
            url.pathname = conformTrailingSlash(url.pathname, enabled);
            return String(url);
        } catch {
            // continue
        }
    }

    // Find the position of the first ? or # character
    const queryOrHashIndex = Math.min(
        pathname.includes("?") ? pathname.indexOf("?") : Infinity,
        pathname.includes("#") ? pathname.indexOf("#") : Infinity
    );

    // conform trailing slash of pathname before query or hash
    if (queryOrHashIndex !== Infinity) {
        // Split the pathname into base and query/hash parts
        const base = pathname.substring(0, queryOrHashIndex);
        const rest = pathname.substring(queryOrHashIndex);

        // Add trailing slash to the base part
        return conformTrailingSlash(base, enabled) + rest;
    }

    const shouldEnable = enabled ?? isTrailingSlashEnabled();
    return shouldEnable ? addTrailingSlash(pathname) : removeTrailingSlash(pathname);
}
