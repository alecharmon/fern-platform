import { normalizeDomainForCookie } from "./with-secure-cookie";

describe("normalizeDomainForCookie", () => {
    describe("localhost handling", () => {
        it("should return localhost as-is", () => {
            expect(normalizeDomainForCookie("localhost")).toBe("localhost");
        });
    });

    describe("fern-hosted sites", () => {
        it("should return fern-hosted domains as-is", () => {
            expect(normalizeDomainForCookie("docs.buildwithfern.com")).toBe("docs.buildwithfern.com");
            expect(normalizeDomainForCookie("api.buildwithfern.com")).toBe("api.buildwithfern.com");
            expect(normalizeDomainForCookie("app.buildwithfern.com")).toBe("app.buildwithfern.com");
        });

        it("should handle subdomains of fern-hosted sites", () => {
            expect(normalizeDomainForCookie("subdomain.docs.buildwithfern.com")).toBe(
                "subdomain.docs.buildwithfern.com"
            );
        });
    });

    describe("TLD-only domains", () => {
        it("should return TLD-only domains as-is", () => {
            expect(normalizeDomainForCookie("com")).toBe("com");
            expect(normalizeDomainForCookie("org")).toBe("org");
            expect(normalizeDomainForCookie("net")).toBe("net");
            expect(normalizeDomainForCookie("io")).toBe("io");
        });
    });

    describe("standard domains", () => {
        it("should add dot prefix for two-part domains", () => {
            expect(normalizeDomainForCookie("example.com")).toBe(".example.com");
            expect(normalizeDomainForCookie("test.org")).toBe(".test.org");
            expect(normalizeDomainForCookie("site.net")).toBe(".site.net");
        });

        it("should handle subdomains by taking last two parts", () => {
            expect(normalizeDomainForCookie("www.example.com")).toBe(".example.com");
            expect(normalizeDomainForCookie("api.example.com")).toBe(".example.com");
            expect(normalizeDomainForCookie("subdomain.example.com")).toBe(".example.com");
        });

        it("should handle multiple subdomains", () => {
            expect(normalizeDomainForCookie("dev.api.example.com")).toBe(".example.com");
            expect(normalizeDomainForCookie("staging.www.example.com")).toBe(".example.com");
            expect(normalizeDomainForCookie("a.b.c.example.com")).toBe(".example.com");
        });
    });

    describe("edge cases", () => {
        it("should handle empty string", () => {
            expect(normalizeDomainForCookie("")).toBe("");
        });

        it("should handle single character domains", () => {
            expect(normalizeDomainForCookie("a")).toBe("a");
        });

        it("should handle domains with multiple dots", () => {
            expect(normalizeDomainForCookie("example.co.uk")).toBe(".example.co.uk");
            expect(normalizeDomainForCookie("www.example.co.uk")).toBe(".example.co.uk");
            expect(normalizeDomainForCookie("api.example.co.uk")).toBe(".example.co.uk");
        });

        it("should handle various country-specific TLDs", () => {
            expect(normalizeDomainForCookie("example.com.au")).toBe(".example.com.au");
            expect(normalizeDomainForCookie("www.example.com.au")).toBe(".example.com.au");
            expect(normalizeDomainForCookie("example.co.jp")).toBe(".example.co.jp");
            expect(normalizeDomainForCookie("example.co.za")).toBe(".example.co.za");
            expect(normalizeDomainForCookie("example.org.uk")).toBe(".example.org.uk");
            expect(normalizeDomainForCookie("example.gov.uk")).toBe(".example.gov.uk");
        });

        it("should handle domains with trailing dots", () => {
            expect(normalizeDomainForCookie("example.com.")).toBe(".com.");
        });

        it("should handle domains with leading dots", () => {
            expect(normalizeDomainForCookie(".example.com")).toBe(".example.com");
        });

        it("should handle IP addresses", () => {
            expect(normalizeDomainForCookie("192.168.1.1")).toBe("192.168.1.1");
            expect(normalizeDomainForCookie("8.8.8.8")).toBe("8.8.8.8");
        });
    });
});
