import { describe, expect, it } from "vitest";

import { generateBranchName, isValidBranchNameFormat } from "../localStorageUtils";

describe("isValidBranchNameFormat", () => {
    describe("stays in sync with generateBranchName", () => {
        it("should accept branch generated with simple name", () => {
            const branchName = generateBranchName("github|12345", "feature");
            expect(isValidBranchNameFormat(branchName)).toBe(true);
        });

        it("should accept branch generated with complex name", () => {
            const branchName = generateBranchName("github|12345", "My Feature-Name_123");
            expect(isValidBranchNameFormat(branchName)).toBe(true);
        });

        it("should accept branch generated with undefined name", () => {
            const branchName = generateBranchName("github|12345", undefined);
            expect(isValidBranchNameFormat(branchName)).toBe(true);
        });

        it("should accept branch generated with empty name", () => {
            const branchName = generateBranchName("github|12345", "");
            expect(isValidBranchNameFormat(branchName)).toBe(true);
        });

        it("should accept branch generated with name containing special characters", () => {
            const branchName = generateBranchName("github|12345", "feature@#$%^&*()");
            expect(isValidBranchNameFormat(branchName)).toBe(true);
        });

        it("should accept branch generated with different user IDs", () => {
            const branchName1 = generateBranchName("github|user001", "feature");
            const branchName2 = generateBranchName("auth0|abc123xyz", "feature");
            const branchName3 = generateBranchName("google-oauth2|999", "feature");

            expect(isValidBranchNameFormat(branchName1)).toBe(true);
            expect(isValidBranchNameFormat(branchName2)).toBe(true);
            expect(isValidBranchNameFormat(branchName3)).toBe(true);
        });

        it("should accept branch generated with long name", () => {
            const longName = "this-is-a-very-long-feature-name-with-many-parts-and-words";
            const branchName = generateBranchName("github|12345", longName);
            expect(isValidBranchNameFormat(branchName)).toBe(true);
        });

        it("should accept branch generated with numeric name", () => {
            const branchName = generateBranchName("github|12345", "123456");
            expect(isValidBranchNameFormat(branchName)).toBe(true);
        });
    });
});
