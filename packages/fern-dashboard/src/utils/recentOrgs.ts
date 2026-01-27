import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getCachedJson, setCachedJson } from "./storageCache";

const RECENT_ORGS_KEY_PREFIX = "fern-recent-orgs";
const MAX_RECENT_ORGS = 3;

export interface RecentOrgsStorage {
    orgs: Auth0OrgName[];
}

/**
 * Get the storage key for recent orgs, scoped by user ID
 */
function getRecentOrgsKey(userId: string): string {
    return `${RECENT_ORGS_KEY_PREFIX}-${userId}`;
}

/**
 * Get the list of recently visited organizations from local storage for a specific user
 */
export function getRecentOrgs(userId: string): Auth0OrgName[] {
    const data = getCachedJson<RecentOrgsStorage>("localStorage", getRecentOrgsKey(userId));
    return data?.orgs || [];
}

/**
 * Get the most recently visited organization for a specific user
 */
export function getMostRecentOrg(userId: string): Auth0OrgName | undefined {
    const recentOrgs = getRecentOrgs(userId);
    return recentOrgs[0];
}

/**
 * Add an organization to the recent list (at the front) for a specific user
 * If it already exists, move it to the front
 * Limit to MAX_RECENT_ORGS
 */
export function addRecentOrg(userId: string, orgName: Auth0OrgName): void {
    const currentOrgs = getRecentOrgs(userId);

    // Remove the org if it already exists
    const filteredOrgs = currentOrgs.filter((org) => org !== orgName);

    // Add to the front
    const updatedOrgs = [orgName, ...filteredOrgs].slice(0, MAX_RECENT_ORGS);

    const data: RecentOrgsStorage = {
        orgs: updatedOrgs
    };

    setCachedJson("localStorage", getRecentOrgsKey(userId), data);
}

/**
 * Check if an organization is in the recent list for a specific user
 */
export function isRecentOrg(userId: string, orgName: Auth0OrgName): boolean {
    const recentOrgs = getRecentOrgs(userId);
    return recentOrgs.includes(orgName);
}
