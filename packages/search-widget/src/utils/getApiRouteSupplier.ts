import urlJoin from "url-join";

export type FernDocsApiRoute = `${string}/api/fern-docs/${string}`;

export function getApiRouteSupplier({
    includeTrailingSlash,
    domain
}: {
    includeTrailingSlash?: boolean;
    domain?: string;
}): (route: FernDocsApiRoute) => string {
    return (route) => {
        if (includeTrailingSlash) {
            return urlJoin(domain || "/", route, "/");
        } else {
            return urlJoin(domain || "/", route);
        }
    };
}
