import { addLeadingSlash } from "./leadingSlash";
import { conformTrailingSlash } from "./trailingSlash";

export function slugToHref(slug: string): string {
    return conformTrailingSlash(addLeadingSlash(slug));
}
