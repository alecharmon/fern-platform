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
    _shortSubHash(userId) +
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
 * Gets relevant branches for a user by filtering all branches received from NavigationStorage
 * to only includes branches that match the user's branch naming format (date-username-shortSubHash-randomHash)
 *
 * @param userId - Auth0 user ID (sub) for branch filtering
 * @returns Array of branch names, sorted by relevance
 */
export function getRelevantBranchesForUser(
  userId: string,
  allBranches: string[]
): string[] {
  try {
    const userShortSubHash = _shortSubHash(userId);

    const userBranches = allBranches.filter((branchName: string) =>
      _matchesBranchFormat(branchName, userShortSubHash)
    );

    // Sort by date (newest first)
    const sortedBranches = userBranches.sort((a: string, b: string) => {
      // Extract the date part (first 10 characters: YYYY-MM-DD)
      const dateA = a.substring(0, 10);
      const dateB = b.substring(0, 10);

      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }

      return b.localeCompare(a);
    });

    return sortedBranches;
  } catch (error) {
    console.warn("Failed to get relevant branches from stored data:", error);
    return [];
  }
}

/******************
 * HELPER FUNCTIONS
 ******************/

/**
 * Ensures user name is url encodable
 * @param name - The name to sanitize
 * @returns The sanitized name
 */
function _sanitizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
}

/**
 * Generate a short 6-character hash from an Auth0 sub
 * Note: the crypto library may not be available on certain client browsers. Can use crypto.subtle if that is an issue.
 * @param sub - Auth0 sub, e.g. "github|002033e4"
 */
function _shortSubHash(sub: string): string {
  const [, idPart] = sub.split("|"); // grab part after |
  if (!idPart) throw new Error("Invalid sub format");

  // Use md5 hash since it's fast, we don't need to be secure here
  const hash = createHash("md5").update(idPart).digest("hex");
  return hash.substring(0, 6);
}

/**
 * Check if a branch name matches the expected format: YYYY-MM-DD-username-shortSubHash-randomHash
 * @param branchName - The branch name to check
 * @param expectedShortSubHash - The expected short sub hash for the user
 */
function _matchesBranchFormat(
  branchName: string,
  expectedShortSubHash: string
): boolean {
  const parts = branchName.split("-");

  // Should have at least 6 parts (date has 3 parts, plus username, shortSubHash, randomHash)
  if (parts.length < 6) {
    return false;
  }

  const shortSubHashIndex = parts.length - 2;
  return parts[shortSubHashIndex] === expectedShortSubHash;
}
