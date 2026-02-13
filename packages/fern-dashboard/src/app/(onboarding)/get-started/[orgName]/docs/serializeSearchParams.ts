/**
 * Serializes Next.js server-side search params into a URLSearchParams object.
 * Handles both single values and arrays of values.
 */
export function serializeSearchParams(searchParams?: Record<string, string | string[] | undefined>): URLSearchParams {
    const params = new URLSearchParams();

    if (!searchParams) {
        return params;
    }

    Object.entries(searchParams).forEach(([key, value]) => {
        if (value) {
            if (Array.isArray(value)) {
                value.forEach((v) => params.append(key, v));
            } else {
                params.append(key, value);
            }
        }
    });

    return params;
}
