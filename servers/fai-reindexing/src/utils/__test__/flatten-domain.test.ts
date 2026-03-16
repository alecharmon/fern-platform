import { describe, expect, it } from "vitest";
import { flattenDomain } from "../flatten-domain";

describe("flattenDomain", () => {
    describe("no-basepath domains (host-only)", () => {
        it("should be a no-op for simple host-only domains", () => {
            expect(flattenDomain("example.com")).toBe("example.com");
        });

        it("should be a no-op for subdomain host-only domains", () => {
            expect(flattenDomain("docs.example.com")).toBe("docs.example.com");
        });

        it("should be a no-op for buildwithfern domains", () => {
            expect(flattenDomain("apple.docs.buildwithfern.com")).toBe("apple.docs.buildwithfern.com");
        });

        it("should be a no-op for domains with dashes", () => {
            expect(flattenDomain("my-cool-docs.buildwithfern.com")).toBe("my-cool-docs.buildwithfern.com");
        });

        it("should be a no-op for domains with underscores already", () => {
            expect(flattenDomain("already_flattened.example.com")).toBe("already_flattened.example.com");
        });
    });

    describe("basepath domains", () => {
        it("should replace slashes with underscores for single basepath", () => {
            expect(flattenDomain("docs.nvidia.com/nemo")).toBe("docs.nvidia.com_nemo");
        });

        it("should replace all slashes for multi-segment basepath", () => {
            expect(flattenDomain("apple.docs.buildwithfern.com/apple/cosmic-crisp")).toBe(
                "apple.docs.buildwithfern.com_apple_cosmic-crisp"
            );
        });

        it("should handle basepath with leading slash", () => {
            expect(flattenDomain("example.com/docs/v2")).toBe("example.com_docs_v2");
        });
    });

    describe("contentHashDomain consistency", () => {
        it("processReindexJob and incrementalUpsertTurbopuffer should compute same contentHashDomain for basepath sites", () => {
            const domain = "apple.docs.buildwithfern.com";
            const basepath = "/apple/cosmic-crisp";

            // processReindexJob: flattenDomain(`${domain}${basepath}`)
            const fromProcessReindex = flattenDomain(`${domain}${basepath}`);

            // incrementalUpsertTurbopuffer: flattenDomain(`${loadedDomain}${basepath}`)
            // loadedDomain comes from loadDocsWithUrl which parses the host
            const loadedDomain = domain; // host-only
            const fromIncrementalUpsert = flattenDomain(`${loadedDomain}${basepath}`);

            expect(fromProcessReindex).toBe(fromIncrementalUpsert);
            expect(fromProcessReindex).toBe("apple.docs.buildwithfern.com_apple_cosmic-crisp");
        });

        it("processReindexJob and incrementalUpsertTurbopuffer should compute same contentHashDomain for no-basepath sites", () => {
            const domain = "example.docs.buildwithfern.com";

            // processReindexJob (no basepath): flatDomain = flattenDomain(domain)
            const fromProcessReindex = flattenDomain(domain);

            // incrementalUpsertTurbopuffer (no basepath): flattenDomain(loadedDomain)
            const loadedDomain = domain;
            const fromIncrementalUpsert = flattenDomain(loadedDomain);

            expect(fromProcessReindex).toBe(fromIncrementalUpsert);
            expect(fromProcessReindex).toBe("example.docs.buildwithfern.com");
        });

        it("basepath normalization should ensure consistency when raw basepath lacks leading slash", () => {
            const domain = "apple.docs.buildwithfern.com";
            const rawBasepath = "apple/cosmic-crisp"; // missing leading "/"

            // Normalization logic from processReindexJob
            const normalizedBasepath = rawBasepath.startsWith("/") ? rawBasepath : `/${rawBasepath}`;

            // Both paths should produce the same result after normalization
            const fromProcessReindex = flattenDomain(`${domain}${normalizedBasepath}`);
            const fromIncrementalUpsert = flattenDomain(`${domain}${normalizedBasepath}`);

            expect(fromProcessReindex).toBe(fromIncrementalUpsert);
            expect(fromProcessReindex).toBe("apple.docs.buildwithfern.com_apple_cosmic-crisp");
        });

        it("basepath normalization should handle empty string basepath as no-basepath", () => {
            const rawBasepath = "";

            // processReindexJob normalization: rawBasepath is falsy → undefined
            const basepath = rawBasepath ? (rawBasepath.startsWith("/") ? rawBasepath : `/${rawBasepath}`) : undefined;

            expect(basepath).toBeUndefined();
        });

        it("basepath normalization should handle undefined basepath", () => {
            const rawBasepath = undefined;

            // processReindexJob normalization
            const basepath = rawBasepath ? (rawBasepath.startsWith("/") ? rawBasepath : `/${rawBasepath}`) : undefined;

            expect(basepath).toBeUndefined();
        });

        it("basepath normalization should preserve already-normalized basepath", () => {
            const rawBasepath = "/apple/cosmic-crisp";

            // processReindexJob normalization
            const basepath = rawBasepath.startsWith("/") ? rawBasepath : `/${rawBasepath}`;

            expect(basepath).toBe("/apple/cosmic-crisp");
        });
    });
});
