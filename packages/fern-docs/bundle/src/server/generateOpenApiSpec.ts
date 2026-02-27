/**
 * Re-exports the shared OpenAPI spec generation from @fern-docs/search-utils.
 * The canonical implementation lives in search-utils so both the docs bundle
 * and the search indexing pipeline share the same code path.
 */
export { generateOpenApiSpec } from "@fern-docs/search-utils";
