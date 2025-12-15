import { HttpMethod } from "@fern-api/docs-utils";
import { camelCase, upperFirst } from "es-toolkit/string";

export function convertNameToAnchorPart(name: string | null | undefined): string | undefined {
    if (name == null) {
        return undefined;
    }
    return upperFirst(camelCase(name));
}

export function extractMethodAndPath(endpoint: string): { method: HttpMethod; path: string } | undefined {
    const [maybeMethod, path] = endpoint.trim().split(" ");

    // parse method into APIV1Read.HttpMethod
    let method: HttpMethod | undefined;

    if (maybeMethod != null) {
        method = maybeMethod.toUpperCase() as HttpMethod;
    }

    // ensure that method is a valid HTTP method
    if (method == null || !HttpMethod[method] || path == null) {
        return undefined;
    }

    return { method, path };
}
