import { sanitizeFilepath } from "../../services/s3/S3Service";

describe("sanitizeFilepath", () => {
    describe("valid paths are passed through correctly", () => {
        it("should handle a simple filename", () => {
            expect(sanitizeFilepath("logo.png")).toBe("logo.png");
        });

        it("should handle a nested path", () => {
            expect(sanitizeFilepath("guides/guide.mdx")).toBe("guides/guide.mdx");
        });

        it("should handle a deeply nested path", () => {
            expect(sanitizeFilepath("a/b/c/d/file.txt")).toBe("a/b/c/d/file.txt");
        });

        it("should handle a path with leading ./", () => {
            expect(sanitizeFilepath("./logo.png")).toBe("logo.png");
        });

        it("should strip leading slashes", () => {
            expect(sanitizeFilepath("/absolute/path.png")).toBe("absolute/path.png");
        });

        it("should normalize redundant slashes", () => {
            expect(sanitizeFilepath("a//b///c.txt")).toBe("a/b/c.txt");
        });
    });

    describe("path traversal attempts are blocked", () => {
        it("should reject simple ../ prefix", () => {
            expect(() => sanitizeFilepath("../secret.txt")).toThrow("path traversal detected");
        });

        it("should reject ../../ prefix", () => {
            expect(() => sanitizeFilepath("../../other-tenant/file.txt")).toThrow("path traversal detected");
        });

        it("should reject deeply nested traversal that escapes", () => {
            expect(() => sanitizeFilepath("a/../../other-tenant/file.txt")).toThrow("path traversal detected");
        });

        it("should reject bare ..", () => {
            expect(() => sanitizeFilepath("..")).toThrow("path traversal detected");
        });

        it("should handle traversal with leading slash", () => {
            // /../../foo normalizes to /foo via path.posix.normalize, then leading / stripped → "foo"
            // This is safe because the traversal is absorbed by the root
            expect(sanitizeFilepath("/../../foo")).toBe("foo");
        });

        it("should reject traversal that fully escapes even with intermediate dirs", () => {
            expect(() => sanitizeFilepath("a/b/c/../../../../other-tenant/file.txt")).toThrow(
                "path traversal detected"
            );
        });
    });

    describe("safe internal ../ that does not escape", () => {
        it("should allow traversal that stays within bounds", () => {
            // a/b/../c normalizes to a/c — this is safe
            expect(sanitizeFilepath("a/b/../c.txt")).toBe("a/c.txt");
        });

        it("should allow traversal at the start that resolves to child", () => {
            // a/../b normalizes to b — still within bounds
            expect(sanitizeFilepath("a/../b.txt")).toBe("b.txt");
        });
    });

    describe("edge cases", () => {
        it("should handle a single dot path", () => {
            expect(sanitizeFilepath(".")).toBe(".");
        });

        it("should handle path with spaces", () => {
            expect(sanitizeFilepath("my files/image.png")).toBe("my files/image.png");
        });

        it("should handle path with special characters", () => {
            expect(sanitizeFilepath("assets/@2x/icon.png")).toBe("assets/@2x/icon.png");
        });
    });
});
