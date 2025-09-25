import { createHash } from "crypto";

import { NAVIGATION_STORAGE_KEY } from "./NavigationStorage";

export function generateBranchName(
  userId: string,
  name: string | undefined
): string {
  const randomHexString = crypto.randomUUID().split("-")[0];
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
 * Derives the branch name from a storage key
 * @param storageKey - The storage key for a given item in storage
 * @returns The branch name
 */
export const getBranchNameFromStorageKey = (
  storageKey: string | null
): string | undefined => {
  if (!storageKey?.startsWith(NAVIGATION_STORAGE_KEY)) {
    return undefined;
  }
  return storageKey.replace(NAVIGATION_STORAGE_KEY, "");
};

/**
 * Check if a branch name matches the user
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

/******************
 * HELPER FUNCTIONS
 ******************/

/**
 * Generate a short 6-character hash from an Auth0 sub
 * Note: the crypto library may not be available on certain client browsers. Can use crypto.subtle if that is an issue.
 * @param sub - Auth0 sub, e.g. "github|002033e4"
 */
export function _generateShortSubHashForUserId(sub: string): string {
  const [, idPart] = sub.split("|"); // grab part after |
  if (!idPart) throw new Error("Invalid sub format");

  // Use md5 hash since it's fast, we don't need to be secure here
  const hash = createHash("md5").update(idPart).digest("hex");
  return hash.substring(0, 6);
}

/**
 * Ensures user name is url encodable
 * @param name - The name to sanitize
 * @returns The sanitized name
 */
function _sanitizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
}
