import { describe, expect, it } from "vitest";
import {
    generateVerificationValue,
    getVerificationHost,
    normalizeDomain,
    validateDomainFormat
} from "@/app/services/domain/validation";

describe("validateDomainFormat", () => {
    describe("valid domains", () => {
        it("accepts simple subdomain", () => {
            expect(validateDomainFormat("docs.mycompany.com").valid).toBe(true);
        });

        it("accepts nested subdomain", () => {
            expect(validateDomainFormat("api.docs.mycompany.com").valid).toBe(true);
        });

        it("accepts domain with numbers", () => {
            expect(validateDomainFormat("docs123.mycompany.com").valid).toBe(true);
        });

        it("accepts domain with hyphens", () => {
            expect(validateDomainFormat("my-docs.mycompany.com").valid).toBe(true);
        });

        it("accepts international TLDs", () => {
            expect(validateDomainFormat("docs.mycompany.co.uk").valid).toBe(true);
        });

        it("accepts short TLDs", () => {
            expect(validateDomainFormat("docs.mycompany.io").valid).toBe(true);
        });

        it("strips protocol from URL", () => {
            expect(validateDomainFormat("https://docs.mycompany.com").valid).toBe(true);
        });

        it("handles trailing whitespace", () => {
            expect(validateDomainFormat("  docs.mycompany.com  ").valid).toBe(true);
        });
    });

    describe("invalid domains", () => {
        it("rejects empty string", () => {
            const result = validateDomainFormat("");
            expect(result.valid).toBe(false);
            expect(result.error).toBe("Domain is required.");
        });

        it("rejects single word without TLD", () => {
            const result = validateDomainFormat("example");
            expect(result.valid).toBe(false);
        });

        it("rejects wildcard domains", () => {
            const result = validateDomainFormat("*.mycompany.com");
            expect(result.valid).toBe(false);
            // Regex fails first, so we get the generic error
            expect(result.error).toBeDefined();
        });

        it("rejects buildwithfern.com subdomains", () => {
            const result = validateDomainFormat("test.buildwithfern.com");
            expect(result.valid).toBe(false);
            expect(result.error).toContain("buildwithfern.com");
        });

        it("rejects buildwithfern.com itself", () => {
            const result = validateDomainFormat("buildwithfern.com");
            expect(result.valid).toBe(false);
        });

        it("rejects docs.buildwithfern.com", () => {
            const result = validateDomainFormat("docs.buildwithfern.com");
            expect(result.valid).toBe(false);
        });

        it("rejects localhost", () => {
            const result = validateDomainFormat("localhost");
            expect(result.valid).toBe(false);
        });

        it("rejects example.com (reserved)", () => {
            const result = validateDomainFormat("example.com");
            expect(result.valid).toBe(false);
            expect(result.error).toContain("reserved");
        });

        it("rejects domains with consecutive hyphens", () => {
            const result = validateDomainFormat("docs--test.example.com");
            expect(result.valid).toBe(false);
            expect(result.error).toContain("consecutive hyphens");
        });
    });
});

describe("normalizeDomain", () => {
    it("lowercases domain", () => {
        expect(normalizeDomain("DOCS.Example.COM")).toBe("docs.example.com");
    });

    it("removes https protocol", () => {
        expect(normalizeDomain("https://docs.example.com")).toBe("docs.example.com");
    });

    it("removes http protocol", () => {
        expect(normalizeDomain("http://docs.example.com")).toBe("docs.example.com");
    });

    it("removes path", () => {
        expect(normalizeDomain("docs.example.com/api/v1")).toBe("docs.example.com");
    });

    it("trims whitespace", () => {
        expect(normalizeDomain("  docs.example.com  ")).toBe("docs.example.com");
    });
});

describe("getVerificationHost", () => {
    it("prepends _fern-verification", () => {
        expect(getVerificationHost("docs.example.com")).toBe("_fern-verification.docs.example.com");
    });

    it("normalizes domain first", () => {
        expect(getVerificationHost("https://DOCS.Example.COM")).toBe("_fern-verification.docs.example.com");
    });
});

describe("generateVerificationValue", () => {
    it("starts with fern-verify=", () => {
        const value = generateVerificationValue();
        expect(value).toMatch(/^fern-verify=/);
    });

    it("contains a UUID", () => {
        const value = generateVerificationValue();
        // UUID format: 8-4-4-4-12 hex characters
        expect(value).toMatch(/^fern-verify=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it("generates unique values", () => {
        const value1 = generateVerificationValue();
        const value2 = generateVerificationValue();
        expect(value1).not.toBe(value2);
    });
});
