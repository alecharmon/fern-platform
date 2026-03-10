import { describe, expect, it } from "vitest";
import { gzipSync } from "zlib";
import {
    type EndpointLocator,
    endpointDetailsKey,
    endpointLocatorKey,
    scanMdxForLoaderRefs
} from "../pre-resolve-loader-data";

// ─── Test Helpers ────────────────────────────────────────

/** Create base64 gzip-encoded JSON data (mimics Merge widget data props) */
function makeGzipData(data: unknown): string {
    return gzipSync(Buffer.from(JSON.stringify(data))).toString("base64");
}

// ─── Key Generators ─────────────────────────────────────

describe("endpointLocatorKey", () => {
    it("generates key with all fields", () => {
        const locator: EndpointLocator = {
            method: "POST",
            path: "/v2/payments",
            example: "ex1",
            apiName: "payments-api"
        };
        expect(endpointLocatorKey(locator)).toBe("POST::/v2/payments::ex1::payments-api");
    });

    it("generates key with missing optional fields", () => {
        const locator: EndpointLocator = { method: "GET", path: "/users" };
        expect(endpointLocatorKey(locator)).toBe("GET::/users::::");
    });

    it("generates key with only example", () => {
        const locator: EndpointLocator = { method: "PUT", path: "/items", example: "update-item" };
        expect(endpointLocatorKey(locator)).toBe("PUT::/items::update-item::");
    });

    it("generates key with only apiName", () => {
        const locator: EndpointLocator = { method: "DELETE", path: "/orders", apiName: "orders-api" };
        expect(endpointLocatorKey(locator)).toBe("DELETE::/orders::::orders-api");
    });
});

describe("endpointDetailsKey", () => {
    it("generates key from apiDefinitionId and endpointId", () => {
        expect(endpointDetailsKey("api-def-123", "endpoint-456" as any)).toBe("api-def-123::endpoint-456");
    });
});

// ─── scanMdxForLoaderRefs ───────────────────────────────

describe("scanMdxForLoaderRefs", () => {
    describe("endpoint scanning", () => {
        it("extracts endpoint from HTML attribute syntax", () => {
            const content = `<EndpointRequestSnippet endpoint="POST /v2/payments" />`;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.endpointLocators).toEqual([
                { method: "POST", path: "/v2/payments", example: undefined, apiName: undefined }
            ]);
        });

        it("extracts endpoint from JSX expression syntax", () => {
            const content = `<EndpointRequestSnippet endpoint={"POST /v2/payments"} />`;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.endpointLocators).toEqual([
                { method: "POST", path: "/v2/payments", example: undefined, apiName: undefined }
            ]);
        });

        it("extracts endpoint with example and api props", () => {
            const content = `<EndpointRequestSnippet endpoint="GET /users/{userId}" example="get-user" api="users-api" />`;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.endpointLocators).toEqual([
                { method: "GET", path: "/users/{userId}", example: "get-user", apiName: "users-api" }
            ]);
        });

        it("extracts endpoint with JSX expression syntax for all props", () => {
            const content = `<EndpointRequestSnippet endpoint={"GET /users/{userId}"} example={"get-user"} api={"users-api"} />`;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.endpointLocators).toEqual([
                { method: "GET", path: "/users/{userId}", example: "get-user", apiName: "users-api" }
            ]);
        });

        it("deduplicates identical endpoints", () => {
            const content = `
                <EndpointRequestSnippet endpoint="POST /v2/payments" />
                <EndpointResponseSnippet endpoint="POST /v2/payments" />
            `;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.endpointLocators).toHaveLength(1);
        });

        it("extracts multiple different endpoints", () => {
            const content = `
                <EndpointRequestSnippet endpoint="POST /v2/payments" />
                <EndpointResponseSnippet endpoint="GET /v2/payments/{id}" />
            `;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.endpointLocators).toHaveLength(2);
        });

        it("skips endpoint with only method (no path)", () => {
            const content = `<EndpointRequestSnippet endpoint="POST" />`;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.endpointLocators).toHaveLength(0);
        });

        it("does not cross-contaminate props between neighboring tags", () => {
            const content = `<EndpointRequestSnippet endpoint="GET /users" /><SchemaSnippet api="my-api" />`;
            const result = scanMdxForLoaderRefs([content]);
            // The endpoint should NOT pick up api="my-api" from the SchemaSnippet tag
            expect(result.endpointLocators).toEqual([
                { method: "GET", path: "/users", example: undefined, apiName: undefined }
            ]);
        });
    });

    describe("webhook scanning", () => {
        it("extracts webhook from HTML attribute syntax", () => {
            const content = `<WebhookSnippet webhook="payment.completed" />`;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.webhookIds).toEqual(["payment.completed"]);
        });

        it("extracts webhook from JSX expression syntax", () => {
            const content = `<WebhookSnippet webhook={"payment.completed"} />`;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.webhookIds).toEqual(["payment.completed"]);
        });

        it("deduplicates identical webhooks", () => {
            const content = `
                <WebhookSnippet webhook="payment.completed" />
                <WebhookSnippet webhook="payment.completed" />
            `;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.webhookIds).toHaveLength(1);
        });
    });

    describe("api name scanning", () => {
        it("extracts api name from HTML attribute syntax", () => {
            const content = `<Schema api="payments-api" />`;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.apiNames).toContain("payments-api");
        });

        it("extracts api name from JSX expression syntax", () => {
            const content = `<Schema api={"payments-api"} />`;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.apiNames).toContain("payments-api");
        });

        it("extracts multiple api names", () => {
            const content = `
                <Schema api="payments-api" />
                <SchemaSnippet api="users-api" />
            `;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.apiNames).toContain("payments-api");
            expect(result.apiNames).toContain("users-api");
        });

        it("deduplicates api names", () => {
            const content = `
                <Schema api="payments-api" />
                <SchemaSnippet api="payments-api" />
            `;
            const result = scanMdxForLoaderRefs([content]);
            const paymentApiCount = result.apiNames.filter((n) => n === "payments-api").length;
            expect(paymentApiCount).toBe(1);
        });
    });

    describe("api link scanning", () => {
        it("extracts endpoint from api: link", () => {
            const content = `[Get payment](api:GET/v2/payments)`;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.endpointLocators).toEqual([expect.objectContaining({ method: "GET", path: "/v2/payments" })]);
        });

        it("extracts endpoint with api name from api: link", () => {
            const content = `[Get payment](api:payments-api:GET/v2/payments)`;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.endpointLocators).toEqual([
                expect.objectContaining({ method: "GET", path: "/v2/payments", apiName: "payments-api" })
            ]);
        });

        it("extracts multiple api links", () => {
            const content = `[A](api:GET/payments) and [B](api:POST/users)`;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.endpointLocators).toHaveLength(2);
        });
    });

    describe("default types detection (Schema-like components)", () => {
        it("adds empty string apiName when Schema component detected", () => {
            const content = `<Schema />`;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.apiNames).toContain("");
        });

        it("adds empty string apiName when SchemaSnippet component detected", () => {
            const content = `<SchemaSnippet />`;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.apiNames).toContain("");
        });

        it("adds empty string apiName when ModelSnippet component detected", () => {
            const content = `<ModelSnippet />`;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.apiNames).toContain("");
        });

        it("adds empty string apiName when MergeSupportedFieldsByIntegrationWidget detected", () => {
            const gzipData = makeGzipData({ apiName: "accounting_v2", model: "Invoice" });
            const content = `<MergeSupportedFieldsByIntegrationWidget data="${gzipData}" />`;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.apiNames).toContain("");
        });

        it("adds empty string apiName when MergeAccessedThirdPartyEndpointsWidget detected", () => {
            const gzipData = makeGzipData([{ apiName: "ats_v2", endpoint: "/candidates" }]);
            const content = `<MergeAccessedThirdPartyEndpointsWidget data="${gzipData}" />`;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.apiNames).toContain("");
        });

        it("does not add empty string apiName when no Schema-like components", () => {
            const content = `<EndpointRequestSnippet endpoint="GET /users" />`;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.apiNames).not.toContain("");
        });
    });

    describe("Merge widget gzip decoding", () => {
        it("extracts apiName from MergeSupportedFieldsByIntegrationWidget (object format)", () => {
            const gzipData = makeGzipData({ apiName: "accounting_v2", model: "Invoice", integrations: [] });
            const content = `<MergeSupportedFieldsByIntegrationWidget requestType="PATCH" data="${gzipData}" />`;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.apiNames).toContain("accounting_v2");
        });

        it("extracts apiName from MergeAccessedThirdPartyEndpointsWidget (array format)", () => {
            const gzipData = makeGzipData([
                { apiName: "ats_v2", endpoint: "/candidates" },
                { apiName: "ats_v2", endpoint: "/jobs" }
            ]);
            const content = `<MergeAccessedThirdPartyEndpointsWidget data="${gzipData}" />`;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.apiNames).toContain("ats_v2");
        });

        it("extracts apiName with JSX expression syntax for data prop", () => {
            const gzipData = makeGzipData({ apiName: "accounting_v2", model: "Invoice" });
            const content = `<MergeSupportedFieldsByIntegrationWidget data={"${gzipData}"} />`;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.apiNames).toContain("accounting_v2");
        });

        it("handles widget with additional props before data", () => {
            const gzipData = makeGzipData({ apiName: "accounting_v2", model: "Invoice" });
            const content = `<MergeSupportedFieldsByIntegrationWidget requestType="PATCH" data="${gzipData}" />`;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.apiNames).toContain("accounting_v2");
        });

        it("handles widget with additional props after data", () => {
            const gzipData = makeGzipData({ apiName: "accounting_v2", model: "Invoice" });
            const content = `<MergeSupportedFieldsByIntegrationWidget data="${gzipData}" requestType="PATCH" />`;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.apiNames).toContain("accounting_v2");
        });

        it("does not add apiName when gzip data has no apiName field", () => {
            const gzipData = makeGzipData({ model: "Invoice" });
            const content = `<MergeSupportedFieldsByIntegrationWidget data="${gzipData}" />`;
            const result = scanMdxForLoaderRefs([content]);
            // Should still have "" from needsDefaultTypes but not any named apiName
            const namedApiNames = result.apiNames.filter((n) => n !== "");
            expect(namedApiNames).toHaveLength(0);
        });

        it("does not add apiName when array format has empty array", () => {
            const gzipData = makeGzipData([]);
            const content = `<MergeAccessedThirdPartyEndpointsWidget data="${gzipData}" />`;
            const result = scanMdxForLoaderRefs([content]);
            const namedApiNames = result.apiNames.filter((n) => n !== "");
            expect(namedApiNames).toHaveLength(0);
        });

        it("ignores malformed base64 data gracefully", () => {
            const content = `<MergeSupportedFieldsByIntegrationWidget data="not-valid-gzip-data!!!" />`;
            const result = scanMdxForLoaderRefs([content]);
            // Should not throw, just skip the malformed data
            expect(result.apiNames).not.toContain(undefined);
        });

        it("extracts apiName from real prod data (base64 gzip)", () => {
            // This is the exact base64 data from the prod error log for accounting_v2
            const prodData =
                "H4sIAAAAAAAAA82Wb28aORDGv0rll4jdPUJpFKSqIoE2RIdpExI1qiJr8E4Wg9fe+A8hRPnuJy8kQEvvkmuQ8m49jJ+x5/nZ5p5wcJhpc0eaBDjXXjmhMlIluU5RkibpqqkWHEmVQCEo5LiRyKZ7pEqsLwptHKafBcrUHhu8Jk2S5GgyjLwS1wLTZDUpEcphZsAJrWzyNDm6LmeTKpFCTTBtLSb8t9wiPVpGfhraRArrSJUUYK0bGe2z0SneeLTPUA5rk5ijciCjFBwkayqRWchsi4VdpCjRYdoGB210yMN2lxVHzhW2mSQjlEVcVo9TnCaoEjBOcIk2adQP9vYPGtFSpaz+iWXyY60yvhnq4X6FZVwy8JXegM/ooHtLx9l7evR+RufnDTqfzOl48leFZVDpDXqN/uCy3m+3av0tCezsw/eDi8P24Qmt8HmnTseXt3TAa70Bnwzn3frJF357cvxtRueXe732eZ0OOo2TL7rWPzq1vaNT3WvFMamSdVdJ88f9emAJzmeDdnSo9cRu5ndzyHCtLwtDoBBR4YdS8NjWY8hhrhXc2pjrPMkxFZCs9NjZjQeD7G+d6XhcZI/9F1o9NZ80SYcet+hRp73JQ2sKQsJQImk64/EXoEnzBxmCBFWeA67zAtRd+aUc8AAX98ag4iGYemQpuJAprF0NpFDIhMM87D3HXJMqUT4foikXI1Km1WOuwVw7ZCJdffsi/JYyCOWsA+eDjtMOJIM8APs0TIXlj4G7AslVELnxwmD6FQzk6NCUe1otKV5WWRzBjRHjEqxdLeT3KVcP1W2mU3RnXiwa8ueWU3Q2qDFbGh4X6nde09age9F5udNrt1uBRuhgwv9xH2d8BCpDZl5Kw7Ptt37ISs+fg4IBPgmbWt74Au0bAeSbF3xSnuJ3fRVKvg4pK9lowQo7v977cLhf2wEz63y8MhXlQ8y8L2l4OSJbsXAwWwu9WTDOIMN33dDPsqGvwERQZEvFxydjOhXU7sOOqdj9rbH9DQn/GzZHrAA3+hOE3gAZ39Ho1yEiKEU7e0t2eC/s4LXYvBb+zearh6uHfwDdl0c9PAwAAA==";
            const content = `<MergeSupportedFieldsByIntegrationWidget requestType="PATCH" data="${prodData}" />`;
            const result = scanMdxForLoaderRefs([content]);
            expect(result.apiNames).toContain("accounting_v2");
        });
    });

    describe("multiple content items (batch behavior)", () => {
        it("scans across multiple content strings", () => {
            const contents = [
                `<EndpointRequestSnippet endpoint="GET /users" />`,
                `<Schema api="payments-api" />`,
                `<WebhookSnippet webhook="payment.completed" />`
            ];
            const result = scanMdxForLoaderRefs(contents);
            expect(result.endpointLocators).toHaveLength(1);
            expect(result.apiNames).toContain("payments-api");
            expect(result.webhookIds).toEqual(["payment.completed"]);
        });

        it("finds Merge widget apiName even when other content lacks api props", () => {
            const gzipData = makeGzipData({ apiName: "accounting_v2", model: "Invoice" });
            const contents = [
                `<div>Some plain content</div>`,
                `<MergeSupportedFieldsByIntegrationWidget data="${gzipData}" />`
            ];
            const result = scanMdxForLoaderRefs(contents);
            expect(result.apiNames).toContain("accounting_v2");
        });

        it("returns empty results for plain content with no references", () => {
            const contents = [`<div>Just some text</div>`, `<p>No special components here</p>`];
            const result = scanMdxForLoaderRefs(contents);
            expect(result.endpointLocators).toHaveLength(0);
            expect(result.webhookIds).toHaveLength(0);
            expect(result.apiNames).toHaveLength(0);
        });

        it("returns empty results for empty content array", () => {
            const result = scanMdxForLoaderRefs([]);
            expect(result.endpointLocators).toHaveLength(0);
            expect(result.webhookIds).toHaveLength(0);
            expect(result.apiNames).toHaveLength(0);
        });
    });

    describe("combined scanning", () => {
        it("finds all reference types in realistic page content", () => {
            const gzipData = makeGzipData({ apiName: "accounting_v2", model: "Invoice" });
            const content = `
# Invoice API

<EndpointRequestSnippet endpoint="PATCH /v1/invoices/{id}" api="accounting_v2" />

<EndpointResponseSnippet endpoint="PATCH /v1/invoices/{id}" api="accounting_v2" />

<MergeSupportedFieldsByIntegrationWidget requestType="PATCH" data="${gzipData}" />

See also: [List invoices](api:GET/v1/invoices)
            `;
            const result = scanMdxForLoaderRefs([content]);

            // Should find the PATCH endpoint (deduplicated)
            expect(result.endpointLocators.length).toBeGreaterThanOrEqual(1);
            // Should find accounting_v2 from api="..." AND from gzip
            expect(result.apiNames).toContain("accounting_v2");
            // Should find default types from MergeSupportedFieldsByIntegrationWidget
            expect(result.apiNames).toContain("");
            // Should find the GET endpoint from api link
            expect(result.endpointLocators).toEqual(
                expect.arrayContaining([expect.objectContaining({ method: "GET", path: "/v1/invoices" })])
            );
        });
    });
});
