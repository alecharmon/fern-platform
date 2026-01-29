import type { WizardFormData } from "@/providers/OnboardingProvider";
import { getCachedItem, getCachedJson, removeCachedItem, setCachedItem, setCachedJson } from "./storageCache";

const ONBOARDING_SESSION_KEY = "fern-onboarding-session";
const ONBOARDING_FORM_DATA_KEY = "fern-onboarding-form-data";
const ONBOARDING_PUBLISH_URL_KEY = "fern-onboarding-publish-url";
const ONBOARDING_GITHUB_REPO_KEY = "fern-onboarding-github-repo";
const ONBOARDING_DOCS_COMMIT_SHA_KEY = "fern-onboarding-docs-commit-sha";
const SESSION_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export interface OnboardingSessionData {
    sessionId: string;
    orgName: string;
    timestamp: number;
}

export interface OnboardingGithubRepoData {
    owner: string;
    repoName: string;
    repoUrl: string;
}

/**
 * Save onboarding session data to sessionStorage
 */
export function saveOnboardingSession(sessionId: string, orgName: string): void {
    const sessionData: OnboardingSessionData = {
        sessionId,
        orgName,
        timestamp: Date.now()
    };
    setCachedJson("sessionStorage", ONBOARDING_SESSION_KEY, sessionData);
}

/**
 * Save form data to sessionStorage
 */
export function saveOnboardingFormData(formData: WizardFormData): void {
    setCachedJson("sessionStorage", ONBOARDING_FORM_DATA_KEY, formData);
}

/**
 * Get onboarding session data from sessionStorage
 * Returns null if expired or not found
 */
export function getOnboardingSession(): OnboardingSessionData | null {
    const sessionData = getCachedJson<OnboardingSessionData>("sessionStorage", ONBOARDING_SESSION_KEY);
    if (!sessionData) {
        return null;
    }

    // Check if expired
    if (Date.now() - sessionData.timestamp > SESSION_EXPIRY_MS) {
        clearOnboardingSession();
        return null;
    }

    return sessionData;
}

/**
 * Get form data from sessionStorage
 */
export function getOnboardingFormData(): WizardFormData | null {
    return getCachedJson<WizardFormData>("sessionStorage", ONBOARDING_FORM_DATA_KEY);
}

/**
 * Save the published site URL to sessionStorage
 * This persists across page refreshes to allow the complete page to be accessed
 */
export function saveSitePublishUrl(url: string): void {
    setCachedItem("sessionStorage", ONBOARDING_PUBLISH_URL_KEY, url);
}

/**
 * Get the published site URL from sessionStorage
 */
export function getSitePublishUrl(): string | null {
    return getCachedItem("sessionStorage", ONBOARDING_PUBLISH_URL_KEY);
}

/**
 * Save GitHub repo data for workflow status polling
 */
export function saveGithubRepoData(owner: string, repoName: string, repoUrl: string): void {
    const data: OnboardingGithubRepoData = { owner, repoName, repoUrl };
    setCachedJson("sessionStorage", ONBOARDING_GITHUB_REPO_KEY, data);
}

/**
 * Get GitHub repo data for workflow status polling
 */
export function getGithubRepoData(): OnboardingGithubRepoData | null {
    return getCachedJson<OnboardingGithubRepoData>("sessionStorage", ONBOARDING_GITHUB_REPO_KEY);
}

/**
 * Save the docs commit SHA for workflow status filtering.
 * This ensures we track the first workflow (docs without API specs) instead of the most recent.
 */
export function saveDocsCommitSha(sha: string): void {
    setCachedItem("sessionStorage", ONBOARDING_DOCS_COMMIT_SHA_KEY, sha);
}

/**
 * Get the docs commit SHA for workflow status filtering
 */
export function getDocsCommitSha(): string | null {
    return getCachedItem("sessionStorage", ONBOARDING_DOCS_COMMIT_SHA_KEY);
}

/**
 * Clear onboarding session data from sessionStorage
 * This only clears the sessionId and orgName, keeping form data and publish URL
 * for the complete page to access after publishing
 */
export function clearOnboardingSession(): void {
    removeCachedItem("sessionStorage", ONBOARDING_SESSION_KEY);
    // Don't clear form data - needed for complete page
    // Don't clear the publish URL - it should persist for the complete page
}

/**
 * Clear all onboarding data including the publish URL
 * Use this when completely resetting the onboarding flow
 */
export function clearAllOnboardingData(): void {
    removeCachedItem("sessionStorage", ONBOARDING_SESSION_KEY);
    removeCachedItem("sessionStorage", ONBOARDING_FORM_DATA_KEY);
    removeCachedItem("sessionStorage", ONBOARDING_PUBLISH_URL_KEY);
    removeCachedItem("sessionStorage", ONBOARDING_GITHUB_REPO_KEY);
    removeCachedItem("sessionStorage", ONBOARDING_DOCS_COMMIT_SHA_KEY);
}

/**
 * Check if there's an active onboarding session
 */
export function hasActiveOnboardingSession(): boolean {
    return getOnboardingSession() !== null;
}
