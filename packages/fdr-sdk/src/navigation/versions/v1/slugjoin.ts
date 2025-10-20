import urljoin from "url-join";

import { Slug } from ".";

// normalizes slug parts and joins them with a single slash
export function slugjoin(...parts: string[]): Slug {
    const trimmedParts = parts.map((part) => part.trim());
    const joined = urljoin(trimmedParts) ?? "";
    const normalized = joined.replaceAll("//*", "/").replace(/^\//, "").replace(/\/$/, "");

    return Slug(normalized);
}
