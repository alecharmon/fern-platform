import { getNextPublicDocsDomain } from "./dev";

describe("getNextPublicDocsDomain", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it("should return undefined when NEXT_PUBLIC_DOCS_DOMAIN is not set", () => {
        delete process.env.NEXT_PUBLIC_DOCS_DOMAIN;
        expect(getNextPublicDocsDomain()).toBeUndefined();
    });

    it("should return undefined when NEXT_PUBLIC_DOCS_DOMAIN is 'ROOT'", () => {
        process.env.NEXT_PUBLIC_DOCS_DOMAIN = "ROOT";
        expect(getNextPublicDocsDomain()).toBeUndefined();
    });

    it("should return the host when NEXT_PUBLIC_DOCS_DOMAIN is a valid domain", () => {
        process.env.NEXT_PUBLIC_DOCS_DOMAIN = "example.docs.buildwithfern.com";
        expect(getNextPublicDocsDomain()).toBe("example.docs.buildwithfern.com");
    });

    it("should return the host when NEXT_PUBLIC_DOCS_DOMAIN includes protocol", () => {
        process.env.NEXT_PUBLIC_DOCS_DOMAIN = "https://example.docs.buildwithfern.com";
        expect(getNextPublicDocsDomain()).toBe("example.docs.buildwithfern.com");
    });

    it("should return undefined for invalid URLs", () => {
        process.env.NEXT_PUBLIC_DOCS_DOMAIN = "not a valid url :::";
        expect(getNextPublicDocsDomain()).toBeUndefined();
    });
});
