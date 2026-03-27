/**
 * Customer docs pages to measure RSC payload sizes against.
 *
 * These pages are fetched from the Vercel preview deployment using
 * the x-fern-host header to route to the appropriate customer docs site.
 *
 * Each customer entry includes a host and a list of representative pages
 * covering both markdown documentation and API reference endpoint pages.
 */

interface CustomerDocsConfig {
    /** Display name for the customer */
    name: string;
    /** The x-fern-host header value used to route requests */
    host: string;
    /** Representative pages to measure (mix of markdown and API pages) */
    pages: string[];
}

export const CUSTOMER_DOCS: CustomerDocsConfig[] = [
    {
        name: "Square",
        host: "square.ferndocs.com",
        pages: [
            // ── Markdown documentation pages ────────────────────────────
            "/docs/homepage",
            "/docs/payments-api/take-payments",
            "/docs/build-basics/using-the-api/using-rest-endpoints",

            // ── API reference endpoint pages ────────────────────────────
            "/reference/square/payments/payments/create-payment",
            "/reference/square/payments/payments/list-payments",
            "/reference/square/customers/customers/create-customer",
            "/reference/square/orders/orders/create-order",
            "/reference/square/catalog/catalog/list-catalog"
        ]
    }
];
