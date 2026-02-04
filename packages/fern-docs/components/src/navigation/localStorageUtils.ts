import { createHash } from "crypto";
import { randomUUID } from "../util/randomUUID";
import { NAVIGATION_STORAGE_KEY } from "./NavigationStorage";

/**
 * Generates unique branch name.
 *
 * NOTE: If you make changes to this function, ensure you update the isValidBranchNameFormat
 * function below to stay in sync. */
export function generateBranchName(userId: string, name: string | undefined): string {
    const randomHexString = randomUUID().split("-")[0];
    return (
        new Date().toISOString().split("T")[0] +
        "-" +
        _sanitizeName(name ?? "") +
        "-" +
        _generateShortSubHashForUserId(userId) +
        "-" +
        randomHexString
    );
}

/**
 * Validates if a branch name follows the expected pattern from generateBranchName. The
 * isValidBranchNameFormat.test.ts file asserts that these two functions stay in sync.
 *
 * @param branchName - The branch name to validate
 * @returns true if valid format, false otherwise
 */
export function isValidBranchNameFormat(branchName: string): boolean {
    // Basic validation: branch name must not be empty
    if (!branchName || typeof branchName !== "string") {
        return false;
    }

    const trimmedBranchName = branchName.trim();
    if (trimmedBranchName.length === 0) {
        return false;
    }

    // Split by hyphen - should have at least 6 parts
    const parts = trimmedBranchName.split("-");
    if (parts.length < 6) {
        return false;
    }

    // Validate first 3 parts form a valid ISO date (YYYY-MM-DD)
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];

    // Ensure all date parts exist
    if (!year || !month || !day) {
        return false;
    }

    // Year should be 4 digits
    if (!/^\d{4}$/.test(year)) {
        return false;
    }

    // Month should be 2 digits (01-12)
    if (!/^\d{2}$/.test(month)) {
        return false;
    }
    const monthNum = parseInt(month, 10);
    if (monthNum < 1 || monthNum > 12) {
        return false;
    }

    // Day should be 2 digits (01-31)
    if (!/^\d{2}$/.test(day)) {
        return false;
    }
    const dayNum = parseInt(day, 10);
    if (dayNum < 1 || dayNum > 31) {
        return false;
    }

    // Validate the date is actually valid (e.g., not Feb 30)
    const dateStr = `${year}-${month}-${day}`;
    const date = new Date(dateStr);
    if (isNaN(date.getTime()) || date.toISOString().split("T")[0] !== dateStr) {
        return false;
    }

    // Validate middle parts (sanitized name)
    // Must be between first 3 parts and last 2 parts
    const nameParts = parts.slice(3, -2);

    // Name cannot be empty
    if (nameParts.length === 0) {
        return false;
    }

    // Each name part should only contain lowercase alphanumeric, underscore, or hyphen
    // (when joined back, it should be equal to its sanitized version)
    const name = nameParts.join("-");
    if (name !== _sanitizeName(name)) {
        return false;
    }

    // Validate second to last part: 6-character hex string (shortSubHash)
    const shortSubHash = parts[parts.length - 2];
    if (!shortSubHash || !/^[a-f0-9]{6}$/.test(shortSubHash)) {
        return false;
    }

    // Validate last part: 8-character hex string (random UUID fragment)
    const randomHex = parts[parts.length - 1];
    if (!randomHex || !/^[a-f0-9]{8}$/.test(randomHex)) {
        return false;
    }

    return true;
}

/**
 * Derives the branch name from a storage key
 * @param storageKey - The storage key for a given item in storage
 * @returns The branch name
 */
export const getBranchNameFromStorageKey = (storageKey: string | null): string | undefined => {
    if (!storageKey?.startsWith(NAVIGATION_STORAGE_KEY)) {
        return undefined;
    }
    return storageKey.replace(NAVIGATION_STORAGE_KEY, "");
};

/**
 * Checks if a branch name matches the user
 * @param branchName - The branch name to check
 * @param userId - The user ID to check
 */
export function branchMatchesUser(branchName: string, userId: string): boolean {
    const expectedShortSubHash = _generateShortSubHashForUserId(userId);
    const parts = branchName.split("-");

    // Should have at least 6 parts (date has 3 parts, plus username, shortSubHash, randomHash)
    if (parts.length < 6) {
        return false;
    }

    const shortSubHashIndex = parts.length - 2;
    return parts[shortSubHashIndex] === expectedShortSubHash;
}

// HELPERS
// ----------------------------------------------------------------------------

/** Sanitizes name to lowercase alphanumeric with underscores/hyphens only */
function _sanitizeName(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
}

/**
 * Generates a short 6-character hash from an Auth0 sub
 * Note: the crypto library may not be available on certain client browsers. Can use crypto.subtle if that is an issue.
 * @param sub - Auth0 sub, e.g. "github|002033e4"
 */
export function _generateShortSubHashForUserId(sub: string): string {
    const [, idPart] = sub.split("|"); // grab part after |
    if (!idPart) {
        throw new Error("Invalid sub format");
    }

    // Use md5 hash since it's fast, we don't need to be secure here
    const hash = createHash("md5").update(idPart).digest("hex");
    return hash.substring(0, 6);
}
