import { describe, expect, it } from "vitest";
import { serializeSearchParams } from "./serializeSearchParams";

describe("serializeSearchParams", () => {
    it("should return empty URLSearchParams when no params provided", () => {
        const result = serializeSearchParams();
        expect(result.toString()).toBe("");
    });

    it("should return empty URLSearchParams when empty object provided", () => {
        const result = serializeSearchParams({});
        expect(result.toString()).toBe("");
    });

    it("should serialize single string value", () => {
        const result = serializeSearchParams({
            key: "value"
        });
        expect(result.toString()).toBe("key=value");
    });

    it("should serialize multiple string values", () => {
        const result = serializeSearchParams({
            first: "value1",
            second: "value2"
        });
        expect(result.get("first")).toBe("value1");
        expect(result.get("second")).toBe("value2");
    });

    it("should serialize array values as multiple entries", () => {
        const result = serializeSearchParams({
            tags: ["tag1", "tag2", "tag3"]
        });
        expect(result.getAll("tags")).toEqual(["tag1", "tag2", "tag3"]);
    });

    it("should skip undefined values", () => {
        const result = serializeSearchParams({
            defined: "value",
            undefined: undefined
        });
        expect(result.toString()).toBe("defined=value");
        expect(result.has("undefined")).toBe(false);
    });

    it("should handle mixed string and array values", () => {
        const result = serializeSearchParams({
            single: "value",
            multiple: ["a", "b"]
        });
        expect(result.get("single")).toBe("value");
        expect(result.getAll("multiple")).toEqual(["a", "b"]);
    });

    it("should handle URL encoding correctly", () => {
        const result = serializeSearchParams({
            url: "https://example.com/path?query=value",
            special: "hello world"
        });
        expect(result.toString()).toContain("url=https%3A%2F%2Fexample.com");
        expect(result.toString()).toContain("special=hello+world");
    });

    it("should handle empty string values", () => {
        const result = serializeSearchParams({
            empty: "",
            nonempty: "value"
        });
        // Empty strings are falsy, so they should be skipped
        expect(result.has("empty")).toBe(false);
        expect(result.get("nonempty")).toBe("value");
    });

    it("should handle postman-team-id parameter", () => {
        const result = serializeSearchParams({
            "postman-team-id": "12345"
        });
        expect(result.get("postman-team-id")).toBe("12345");
    });
});
