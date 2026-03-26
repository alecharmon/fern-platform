/**
 * Smoke test pages derived from the smoke-test docs.yml navigation.
 *
 * Each entry is a path that should return a 200 OK and render without
 * uncaught page errors. Shared between smoke.spec.ts and rsc-payload.spec.ts.
 */
export const PAGES = [
    // Home tab — markdown pages
    "/home/welcome",
    "/home/home/get-started/plaintext-test",
    "/home/home/get-started/external-dependency-test",

    // Guides tab — markdown pages with explicit slugs
    "/home/concepts",
    "/home/sdks",

    // Error codes
    "/home/error-codes",

    // REST API reference (specific endpoints)
    "/home/rest-api/rest-api/plant/add-plant",
    "/home/rest-api/rest-api/catalog/create-catalog-item",
    "/home/rest-api/rest-api/catalog/bulk-upsert-catalog-items",
    "/home/rest-api/rest-api/catalog/search-catalog-items",

    // Events API reference (specific endpoint)
    "/home/events-api/events-api/inventory/inventory",

    // gRPC API reference (slug derived from display name "gRPC API")
    // protoc-gen-openapi v0.1.12 sets x-fern-sdk-method-name: CreateComment → kebab-case slug
    "/home/g-rpc-api/g-rpc-api/comments-service/create-comment",

    // Webhook API reference (specific endpoint)
    "/home/webhook-api/webhook-api/orders/on-order-created",

    // Tasks API — overview page + endpoint
    "/home/api-overview",
    "/home/tasks-api/tasks-api/create-task",

    // Changelog tab
    "/home/changelog",

    // Second product
    "/second-product/overview/getting-started/introduction"
];
