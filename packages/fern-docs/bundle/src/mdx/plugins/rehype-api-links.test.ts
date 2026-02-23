import { describe, expect, it } from "vitest";
import { parseApiLinkHref, sanitizeApiLinks } from "./rehype-api-links";

describe("parseApiLinkHref", () => {
    it("parses basic method + path", () => {
        expect(parseApiLinkHref("api:POST/v2/payments")).toEqual({
            method: "POST",
            path: "/v2/payments"
        });
    });

    it("parses GET method", () => {
        expect(parseApiLinkHref("api:GET/users")).toEqual({
            method: "GET",
            path: "/users"
        });
    });

    it("parses with api name prefix", () => {
        expect(parseApiLinkHref("api:payments-api:POST/v2/payments")).toEqual({
            method: "POST",
            path: "/v2/payments",
            apiName: "payments-api"
        });
    });

    it("is case-insensitive for HTTP method", () => {
        expect(parseApiLinkHref("api:post/v2/payments")).toEqual({
            method: "POST",
            path: "/v2/payments"
        });
    });

    it("returns undefined for non-api: hrefs", () => {
        expect(parseApiLinkHref("https://example.com")).toBeUndefined();
        expect(parseApiLinkHref("/docs/intro")).toBeUndefined();
        expect(parseApiLinkHref("#anchor")).toBeUndefined();
    });

    it("returns undefined for empty api: href", () => {
        expect(parseApiLinkHref("api:")).toBeUndefined();
    });

    it("returns undefined for invalid method", () => {
        expect(parseApiLinkHref("api:INVALID/path")).toBeUndefined();
    });

    it("returns undefined for missing path", () => {
        expect(parseApiLinkHref("api:POST")).toBeUndefined();
    });

    it("returns undefined for api name with invalid method", () => {
        expect(parseApiLinkHref("api:my-api:INVALID/path")).toBeUndefined();
    });

    it("handles path with multiple segments", () => {
        expect(parseApiLinkHref("api:GET/v2/payments/{paymentId}/refunds")).toEqual({
            method: "GET",
            path: "/v2/payments/{paymentId}/refunds"
        });
    });

    it("decodes URL-encoded curly braces back to real braces", () => {
        expect(parseApiLinkHref("api:GET/v2/payments/%7BpaymentId%7D")).toEqual({
            method: "GET",
            path: "/v2/payments/{paymentId}"
        });
    });

    it("handles all HTTP methods", () => {
        for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]) {
            expect(parseApiLinkHref(`api:${method}/path`)).toEqual({
                method,
                path: "/path"
            });
        }
    });
});

describe("sanitizeApiLinks", () => {
    it("encodes curly braces inside api: link hrefs", () => {
        expect(sanitizeApiLinks("[Get payment](api:GET/v2/payments/{paymentId})")).toBe(
            "[Get payment](api:GET/v2/payments/%7BpaymentId%7D)"
        );
    });

    it("handles multiple path params", () => {
        expect(sanitizeApiLinks("[Get refund](api:GET/v2/payments/{paymentId}/refunds/{refundId})")).toBe(
            "[Get refund](api:GET/v2/payments/%7BpaymentId%7D/refunds/%7BrefundId%7D)"
        );
    });

    it("handles api name prefix with curly braces", () => {
        expect(sanitizeApiLinks("[Get payment](api:payments-api:GET/v2/payments/{paymentId})")).toBe(
            "[Get payment](api:payments-api:GET/v2/payments/%7BpaymentId%7D)"
        );
    });

    it("does not touch non-api links", () => {
        const content = "[Example](https://example.com/{id})";
        expect(sanitizeApiLinks(content)).toBe(content);
    });

    it("does not touch curly braces outside of links", () => {
        const content = "Use `{paymentId}` as a path parameter";
        expect(sanitizeApiLinks(content)).toBe(content);
    });

    it("handles multiple api links in the same content", () => {
        const content = "[A](api:GET/payments/{id}) and [B](api:POST/users/{userId})";
        expect(sanitizeApiLinks(content)).toBe("[A](api:GET/payments/%7Bid%7D) and [B](api:POST/users/%7BuserId%7D)");
    });

    it("round-trips: sanitize then parse recovers original path", () => {
        const original = "[Get payment](api:GET/v2/payments/{paymentId})";
        const sanitized = sanitizeApiLinks(original);
        // Extract the href from the sanitized markdown
        const href = sanitized.match(/\(([^)]+)\)/)?.[1];
        const parsed = parseApiLinkHref(href!);
        expect(parsed).toEqual({
            method: "GET",
            path: "/v2/payments/{paymentId}"
        });
    });
});
