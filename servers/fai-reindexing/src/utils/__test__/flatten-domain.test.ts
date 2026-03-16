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
});
