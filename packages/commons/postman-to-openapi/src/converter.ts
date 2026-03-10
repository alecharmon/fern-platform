import { convertAuth } from "./convert-auth.js";
import { convertOperations } from "./convert-operations.js";
import { extractServers } from "./convert-servers.js";
import type { OpenAPISpec } from "./openapi-types.js";
import type { PostmanCollection } from "./postman-types.js";
import { extractDescription } from "./utils.js";

/**
 * Converts a Postman Collection v2.1 to an OpenAPI 3.1.0 specification.
 *
 * Preserves the structure of the Postman collection:
 * - Folders become OpenAPI tags
 * - Items become operations under paths
 * - Request/response examples are used to infer schemas
 * - Auth configuration is converted to security schemes
 * - Server URLs are extracted from request URLs
 */
export function convert(collection: PostmanCollection): OpenAPISpec {
    const spec: OpenAPISpec = {
        openapi: "3.1.0",
        info: {
            title: collection.info.name,
            version: collection.info.version ?? "1.0.0",
            description: extractDescription(collection.info.description)
        },
        paths: {}
    };

    // Extract servers from all requests
    const servers = extractServers(collection.item, collection.variable);
    if (servers.length > 0) {
        spec.servers = servers;
    }

    // Convert auth
    const { securitySchemes, security } = convertAuth(collection.auth);

    // Convert operations (items and folders)
    const { paths, tags } = convertOperations(collection.item, collection.variable);
    spec.paths = paths;

    if (tags.length > 0) {
        spec.tags = tags;
    }

    // Set up components
    if (Object.keys(securitySchemes).length > 0) {
        spec.components = { securitySchemes };
    }

    if (security.length > 0) {
        spec.security = security;
    }

    return spec;
}
