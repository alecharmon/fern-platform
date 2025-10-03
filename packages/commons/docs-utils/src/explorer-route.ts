import { addLeadingSlash } from "./leading-slash";
import { conformTrailingSlash, removeTrailingSlash } from "./trailing-slash";

/**
 * Conforms the slug to the explorer route.
 */
export function conformExplorerRoute(slugOrPathname: string): string {
    return conformTrailingSlash(addLeadingSlash(slugOrPathname) + "?explorer=true");
}

export function getExplorerBasePath(slugOrPathname: string): string {
    return conformTrailingSlash(addLeadingSlash(slugOrPathname.replace("?explorer=true", "")));
}

export function isExplorerRoute(pathname: string): boolean {
    return removeTrailingSlash(pathname).endsWith("?explorer=true");
}
