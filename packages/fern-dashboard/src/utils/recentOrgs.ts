import type { Auth0OrgName } from "@/app/services/auth0/types";

const RECENT_ORGS_KEY = "fern-recent-orgs";
const MAX_RECENT_ORGS = 3;

export interface RecentOrgsStorage {
    orgs: Auth0OrgName[];
}

/**
 * Get the list of recently visited organizations from local storage
 */
export function getRecentOrgs(): Auth0OrgName[] {
    if (typeof window === "undefined") {
        return [];
    }

    try {
        const stored = localStorage.getItem(RECENT_ORGS_KEY);
        if (!stored) {
            return [];
        }

        const data = JSON.parse(stored) as RecentOrgsStorage;
        return data.orgs || [];
    } catch (error) {
        console.error("Failed to parse recent orgs from localStorage", error);
        return [];
    }
}

/**
 * Get the most recently visited organization
 */
export function getMostRecentOrg(): Auth0OrgName | undefined {
    const recentOrgs = getRecentOrgs();
    return recentOrgs[0];
}

/**
 * Add an organization to the recent list (at the front)
 * If it already exists, move it to the front
 * Limit to MAX_RECENT_ORGS
 */
export function addRecentOrg(orgName: Auth0OrgName): void {
    if (typeof window === "undefined") {
        return;
    }

    try {
        const currentOrgs = getRecentOrgs();

        // Remove the org if it already exists
        const filteredOrgs = currentOrgs.filter((org) => org !== orgName);

        // Add to the front
        const updatedOrgs = [orgName, ...filteredOrgs].slice(0, MAX_RECENT_ORGS);

        const data: RecentOrgsStorage = {
            orgs: updatedOrgs
        };

        localStorage.setItem(RECENT_ORGS_KEY, JSON.stringify(data));
    } catch (error) {
        console.error("Failed to save recent org to localStorage", error);
    }
}

/**
 * Check if an organization is in the recent list
 */
export function isRecentOrg(orgName: Auth0OrgName): boolean {
    const recentOrgs = getRecentOrgs();
    return recentOrgs.includes(orgName);
}
