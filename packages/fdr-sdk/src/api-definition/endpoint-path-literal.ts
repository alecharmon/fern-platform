import type { EndpointPathPart } from "../orpc-client/api/shared.js";
import { EndpointPathLiteral } from "../orpc-client/shared.js";

/**
 * Commonly used in Express.js and how we render paths in the UI.
 */
export function toColonEndpointPathLiteral(pathParts: EndpointPathPart[]): EndpointPathLiteral {
    return EndpointPathLiteral(
        pathParts.map((part) => (part.type === "literal" ? part.value : `:${part.value}`)).join("")
    );
}

/**
 * Used in OpenAPI specification and Fern Definition. This is how we store EndpointPathLiteral in the snippet resolver.
 */
export function toCurlyBraceEndpointPathLiteral(pathParts: EndpointPathPart[]): EndpointPathLiteral {
    return EndpointPathLiteral(
        pathParts.map((part) => (part.type === "literal" ? part.value : `{${part.value}}`)).join("")
    );
}
