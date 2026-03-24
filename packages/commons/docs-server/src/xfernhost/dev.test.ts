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

    it("should preserve basepath with %2F encoding", () => {
        process.env.NEXT_PUBLIC_DOCS_DOMAIN = "dynamo-adi.docs.buildwithfern.com/dynamo";
        expect(getNextPublicDocsDomain()).toBe("dynamo-adi.docs.buildwithfern.com%2Fdynamo");
    });

    it("should preserve multi-segment basepath with %2F encoding", () => {
        process.env.NEXT_PUBLIC_DOCS_DOMAIN = "docs.nvidia.com/nemo/v2";
        expect(getNextPublicDocsDomain()).toBe("docs.nvidia.com%2Fnemo%2Fv2");
    });

    it("should strip trailing slash from basepath", () => {
        process.env.NEXT_PUBLIC_DOCS_DOMAIN = "example.com/docs/";
        expect(getNextPublicDocsDomain()).toBe("example.com%2Fdocs");
    });
});
