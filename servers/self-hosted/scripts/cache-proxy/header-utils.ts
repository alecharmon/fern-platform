/**
 * Normalize a potentially duplicated Location header value.
 *
 * The Next.js standalone server may emit duplicate Location headers for
 * redirect responses: the app renderer calls setHeader("location", url) and
 * then the server framework iterates result metadata and calls
 * appendHeader("location", url) on the same response object.
 *
 * When Bun's Headers.get() reads these, it joins duplicates per the Fetch
 * spec with ", ", producing a malformed URL that browsers navigate to
 * literally (e.g. "/path/a, /path/a").
 *
 * This function detects the ", " separator and returns only the first value.
 * It is a no-op for well-formed single-value headers because ", " (comma
 * followed by a space) cannot appear unencoded in a valid URI.
 */
export function normalizeLocationHeader(location: string | null): string | null {
    if (location?.includes(", ")) {
        return location.split(", ")[0];
    }
    return location;
}
