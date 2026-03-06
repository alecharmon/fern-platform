import { describe, expect, it } from "vitest";

import { isValidDomain } from "../route";

describe("isValidDomain", () => {
    describe("valid domains", () => {
        it("accepts a simple domain", () => {
            expect(isValidDomain("docs.example.com")).toBe(true);
        });

        it("accepts a nested subdomain", () => {
            expect(isValidDomain("api.docs.example.com")).toBe(true);
        });

        it("accepts a domain with hyphens", () => {
            expect(isValidDomain("my-docs.example.com")).toBe(true);
        });

        it("accepts a domain with numbers", () => {
            expect(isValidDomain("docs123.example.com")).toBe(true);
        });

        it("accepts international TLDs", () => {
            expect(isValidDomain("docs.example.co.uk")).toBe(true);
        });

        it("accepts a domain with a path", () => {
            expect(isValidDomain("docs.example.com/api")).toBe(true);
        });

        it("accepts a domain with a multi-segment path", () => {
            expect(isValidDomain("docs.example.com/api/v1")).toBe(true);
        });

        it("accepts buildwithfern.com subdomains", () => {
            expect(isValidDomain("docs.buildwithfern.com")).toBe(true);
        });
    });

    describe("IPv4 addresses", () => {
        it("rejects a plain IPv4 address", () => {
            expect(isValidDomain("192.168.1.1")).toBe(false);
        });

        it("rejects loopback IPv4", () => {
            expect(isValidDomain("127.0.0.1")).toBe(false);
        });

        it("rejects 0.0.0.0", () => {
            expect(isValidDomain("0.0.0.0")).toBe(false);
        });

        it("rejects IPv4 with a path", () => {
            expect(isValidDomain("192.168.1.1/sitemap.xml")).toBe(false);
        });
    });

    describe("IPv6 addresses", () => {
        it("rejects bracketed IPv6", () => {
            expect(isValidDomain("[::1]")).toBe(false);
        });

        it("rejects full IPv6 in brackets", () => {
            expect(isValidDomain("[2001:db8::1]")).toBe(false);
        });
    });

    describe("port specifications", () => {
        it("rejects a domain with a port", () => {
            expect(isValidDomain("example.com:5432")).toBe(false);
        });

        it("rejects a domain with HTTPS port", () => {
            expect(isValidDomain("example.com:443")).toBe(false);
        });

        it("rejects an internal host with a port", () => {
            expect(isValidDomain("fai.buildwithfern.com:9090")).toBe(false);
        });
    });

    describe("invalid hostnames", () => {
        it("rejects an empty string", () => {
            expect(isValidDomain("")).toBe(false);
        });

        it("rejects a single word without TLD", () => {
            expect(isValidDomain("localhost")).toBe(false);
        });

        it("rejects a hostname without a dot", () => {
            expect(isValidDomain("internalhost")).toBe(false);
        });

        it("rejects a wildcard domain", () => {
            expect(isValidDomain("*.example.com")).toBe(false);
        });

        it("rejects a domain starting with a hyphen", () => {
            expect(isValidDomain("-docs.example.com")).toBe(false);
        });

        it("rejects a domain ending with a hyphen", () => {
            expect(isValidDomain("docs-.example.com")).toBe(false);
        });

        it("rejects a domain with a single-char TLD", () => {
            expect(isValidDomain("docs.example.x")).toBe(false);
        });

        it("rejects a domain with spaces", () => {
            expect(isValidDomain("docs .example.com")).toBe(false);
        });

        it("rejects a domain with underscores", () => {
            expect(isValidDomain("docs_site.example.com")).toBe(false);
        });
    });

    describe("path traversal", () => {
        it("rejects path traversal with ..", () => {
            expect(isValidDomain("docs.example.com/../etc/passwd")).toBe(false);
        });

        it("rejects path with single dot segment", () => {
            expect(isValidDomain("docs.example.com/./api")).toBe(false);
        });

        it("rejects trailing slash (empty path segment)", () => {
            expect(isValidDomain("docs.example.com/")).toBe(false);
        });

        it("rejects double slash in path (empty segment)", () => {
            expect(isValidDomain("docs.example.com//api")).toBe(false);
        });
    });
});
