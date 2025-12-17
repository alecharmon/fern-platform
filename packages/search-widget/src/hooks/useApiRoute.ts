import { getApiRouteSupplier } from "../utils/getApiRouteSupplier";

export type FernDocsApiRoute = `${string}/api/fern-docs/${string}`;

interface Options {
    includeTrailingSlash?: boolean;
    domain?: string;
}

export function useApiRoute(route: FernDocsApiRoute, domain?: string, options?: Options): string {
    return getApiRouteSupplier({ domain: domain || "", ...options })(route);
}
