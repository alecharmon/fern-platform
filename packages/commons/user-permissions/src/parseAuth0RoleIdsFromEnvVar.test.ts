import { describe, expect, it } from "vitest";
import { parseAuth0RoleIdsFromEnvVar } from "./index";

describe("parseAuth0RoleIdsFromEnvVar", () => {
    it("should throw an error if envVarValue is undefined", () => {
        expect(() => parseAuth0RoleIdsFromEnvVar(undefined)).toThrow(
            "AUTH0_ROLES environment variable is not defined."
        );
    });

    it("should throw an error if envVarValue is null", () => {
        expect(() => parseAuth0RoleIdsFromEnvVar(null as never)).toThrow(
            "AUTH0_ROLES environment variable is not defined."
        );
    });

    it("should parse a valid JSON string into a Record<string, Auth0RoleID>", () => {
        const jsonString = JSON.stringify({
            admin: "rol_123",
            member: "rol_456"
        });
        const expected = {
            admin: "rol_123",
            member: "rol_456"
        };
        expect(parseAuth0RoleIdsFromEnvVar(jsonString)).toEqual(expected);
    });

    it("should throw an error for an invalid JSON string", () => {
        const invalidJsonString = "{admin:rol_123}"; // Missing quotes around key and value
        expect(() => parseAuth0RoleIdsFromEnvVar(invalidJsonString)).toThrow(
            "Failed to parse AUTH0_ROLES environment variable."
        );
    });

    it("should handle an empty JSON object", () => {
        const emptyObject = "{}";
        expect(parseAuth0RoleIdsFromEnvVar(emptyObject)).toEqual({});
    });

    it("should read from process.env.AUTH0_ROLES if no argument is provided", () => {
        const originalEnv = process.env;
        process.env = { ...originalEnv, AUTH0_ROLES: JSON.stringify({ test: "rol_test" }) };
        try {
            expect(parseAuth0RoleIdsFromEnvVar()).toEqual({ test: "rol_test" });
        } finally {
            process.env = originalEnv;
        }
    });
});
