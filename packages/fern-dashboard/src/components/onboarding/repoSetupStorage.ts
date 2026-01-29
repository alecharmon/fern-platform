/**
 * Storage utilities for tracking repo setup state during onboarding.
 *
 * When the user creates an organization, we fire-and-forget a call to set-up-repo.
 * This stores the result so that useDocsSubmission can retrieve the repo name
 * when it's time to customize.
 */

const STORAGE_KEY_PREFIX = "fern-repo-setup-";

export interface RepoSetupResult {
    status: "pending" | "success" | "error";
    repoName?: string;
    githubRepoUrl?: string;
    error?: string;
    startedAt: number;
}

/**
 * Gets the storage key for a given org name
 */
function getStorageKey(orgName: string): string {
    return `${STORAGE_KEY_PREFIX}${orgName}`;
}

/**
 * Marks repo setup as pending for an organization
 */
export function markRepoSetupPending(orgName: string): void {
    try {
        const result: RepoSetupResult = {
            status: "pending",
            startedAt: Date.now()
        };
        localStorage.setItem(getStorageKey(orgName), JSON.stringify(result));
    } catch {
        // localStorage not available (SSR, private browsing, etc.)
    }
}

/**
 * Stores successful repo setup result
 */
export function storeRepoSetupSuccess(orgName: string, repoName: string, githubRepoUrl: string): void {
    try {
        const result: RepoSetupResult = {
            status: "success",
            repoName,
            githubRepoUrl,
            startedAt: Date.now()
        };
        localStorage.setItem(getStorageKey(orgName), JSON.stringify(result));
    } catch {
        // localStorage not available
    }
}

/**
 * Stores repo setup error
 */
export function storeRepoSetupError(orgName: string, error: string): void {
    try {
        const result: RepoSetupResult = {
            status: "error",
            error,
            startedAt: Date.now()
        };
        localStorage.setItem(getStorageKey(orgName), JSON.stringify(result));
    } catch {
        // localStorage not available
    }
}

/**
 * Gets the repo setup result for an organization
 */
export function getRepoSetupResult(orgName: string): RepoSetupResult | null {
    try {
        const stored = localStorage.getItem(getStorageKey(orgName));
        if (!stored) {
            return null;
        }
        return JSON.parse(stored) as RepoSetupResult;
    } catch {
        return null;
    }
}

/**
 * Clears the repo setup result for an organization
 */
export function clearRepoSetupResult(orgName: string): void {
    try {
        localStorage.removeItem(getStorageKey(orgName));
    } catch {
        // localStorage not available
    }
}

/**
 * Waits for repo setup to complete, polling localStorage.
 * Returns the repo name if successful, or null if it times out or errors.
 *
 * @param orgName - The organization name
 * @param timeoutMs - Maximum time to wait (default 30 seconds)
 * @param pollIntervalMs - Polling interval (default 500ms)
 */
export async function waitForRepoSetup(
    orgName: string,
    timeoutMs: number = 30000,
    pollIntervalMs: number = 500
): Promise<{ repoName: string; githubRepoUrl: string } | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        const result = getRepoSetupResult(orgName);

        if (result?.status === "success" && result.repoName && result.githubRepoUrl) {
            return { repoName: result.repoName, githubRepoUrl: result.githubRepoUrl };
        }

        if (result?.status === "error") {
            console.warn("[waitForRepoSetup] Repo setup failed:", result.error);
            return null;
        }

        // Still pending or no result yet, wait and poll again
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    console.warn("[waitForRepoSetup] Timed out waiting for repo setup");
    return null;
}
