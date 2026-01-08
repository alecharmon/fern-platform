import type { WizardFormData } from "@/providers/OnboardingProvider";

const ONBOARDING_SESSION_KEY = "fern-onboarding-session";
const ONBOARDING_FORM_DATA_KEY = "fern-onboarding-form-data";
const ONBOARDING_PUBLISH_URL_KEY = "fern-onboarding-publish-url";
const SESSION_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export interface OnboardingSessionData {
    sessionId: string;
    orgName: string;
    timestamp: number;
}

/**
 * Save onboarding session data to sessionStorage
 */
export function saveOnboardingSession(sessionId: string, orgName: string): void {
    if (typeof window === "undefined") {
        return;
    }

    try {
        const sessionData: OnboardingSessionData = {
            sessionId,
            orgName,
            timestamp: Date.now()
        };

        sessionStorage.setItem(ONBOARDING_SESSION_KEY, JSON.stringify(sessionData));
    } catch (error) {
        console.error("Failed to save onboarding session to sessionStorage", error);
    }
}

/**
 * Save form data to sessionStorage
 */
export function saveOnboardingFormData(formData: WizardFormData): void {
    if (typeof window === "undefined") {
        return;
    }

    try {
        sessionStorage.setItem(ONBOARDING_FORM_DATA_KEY, JSON.stringify(formData));
    } catch (error) {
        console.error("Failed to save onboarding form data to sessionStorage", error);
    }
}

/**
 * Get onboarding session data from sessionStorage
 * Returns null if expired or not found
 */
export function getOnboardingSession(): OnboardingSessionData | null {
    if (typeof window === "undefined") {
        return null;
    }

    try {
        const stored = sessionStorage.getItem(ONBOARDING_SESSION_KEY);
        if (!stored) {
            return null;
        }

        const sessionData = JSON.parse(stored) as OnboardingSessionData;

        // Check if expired
        if (Date.now() - sessionData.timestamp > SESSION_EXPIRY_MS) {
            clearOnboardingSession();
            return null;
        }

        return sessionData;
    } catch (error) {
        console.error("Failed to parse onboarding session from sessionStorage", error);
        return null;
    }
}

/**
 * Get form data from sessionStorage
 */
export function getOnboardingFormData(): WizardFormData | null {
    if (typeof window === "undefined") {
        return null;
    }

    try {
        const stored = sessionStorage.getItem(ONBOARDING_FORM_DATA_KEY);
        if (!stored) {
            return null;
        }

        return JSON.parse(stored) as WizardFormData;
    } catch (error) {
        console.error("Failed to parse onboarding form data from sessionStorage", error);
        return null;
    }
}

/**
 * Save the published site URL to sessionStorage
 * This persists across page refreshes to allow the complete page to be accessed
 */
export function saveSitePublishUrl(url: string): void {
    if (typeof window === "undefined") {
        return;
    }

    try {
        sessionStorage.setItem(ONBOARDING_PUBLISH_URL_KEY, url);
    } catch (error) {
        console.error("Failed to save site publish URL to sessionStorage", error);
    }
}

/**
 * Get the published site URL from sessionStorage
 */
export function getSitePublishUrl(): string | null {
    if (typeof window === "undefined") {
        return null;
    }

    try {
        return sessionStorage.getItem(ONBOARDING_PUBLISH_URL_KEY);
    } catch (error) {
        console.error("Failed to get site publish URL from sessionStorage", error);
        return null;
    }
}

/**
 * Clear onboarding session data from sessionStorage
 * This only clears the sessionId and orgName, keeping form data and publish URL
 * for the complete page to access after publishing
 */
export function clearOnboardingSession(): void {
    if (typeof window === "undefined") {
        return;
    }

    try {
        sessionStorage.removeItem(ONBOARDING_SESSION_KEY);
        // Don't clear form data - needed for complete page
        // sessionStorage.removeItem(ONBOARDING_FORM_DATA_KEY);
        // Don't clear the publish URL - it should persist for the complete page
        // sessionStorage.removeItem(ONBOARDING_PUBLISH_URL_KEY);
    } catch (error) {
        console.error("Failed to clear onboarding session from sessionStorage", error);
    }
}

/**
 * Clear all onboarding data including the publish URL
 * Use this when completely resetting the onboarding flow
 */
export function clearAllOnboardingData(): void {
    if (typeof window === "undefined") {
        return;
    }

    try {
        sessionStorage.removeItem(ONBOARDING_SESSION_KEY);
        sessionStorage.removeItem(ONBOARDING_FORM_DATA_KEY);
        sessionStorage.removeItem(ONBOARDING_PUBLISH_URL_KEY);
    } catch (error) {
        console.error("Failed to clear all onboarding data from sessionStorage", error);
    }
}

/**
 * Check if there's an active onboarding session
 */
export function hasActiveOnboardingSession(): boolean {
    return getOnboardingSession() !== null;
}
