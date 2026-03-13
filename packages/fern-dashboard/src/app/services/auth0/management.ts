import { getRoleMapping, isSuperUser, type Roles } from "@fern-api/user-permissions";
import {
    type ApiResponse,
    type GetInvitations200ResponseOneOfInner,
    type GetMembers200ResponseOneOfInner,
    type GetUsers200ResponseOneOfInner,
    ManagementClient
} from "auth0";
import { v4 as uuidv4 } from "uuid";
import { AsyncRedisCache } from "../redis/AsyncRedisCache";
import { type InviteToken, RedisCacheKey, RedisCacheKeyType } from "../redis/cacheKey";
import { redisDel, redisGet, redisSet } from "../redis/redis";
import { type Auth0Organization, Auth0OrgID, Auth0OrgName, Auth0UserID } from "./types";
import { convertToAuth0Organization } from "./utils";

// Re-export isSuperUser for convenience
export { isSuperUser };

export const FERN_ORG_NAME = Auth0OrgName("fern");

/****************************
 * getAuth0ManagementClient *
 ****************************/

let AUTH0_MANAGEMENT_CLIENT: ManagementClient | undefined;

export type Auth0User = GetUsers200ResponseOneOfInner;

export type Auth0ManagementErrorCode = "CONFIG_MISSING" | "USER_NOT_FOUND" | "MULTIPLE_USERS_FOUND" | "USER_ID_MISSING";
export class Auth0ManagementError extends Error {
    errorCode?: Auth0ManagementErrorCode;

    constructor(message: string, options?: { errorCode?: Auth0ManagementErrorCode; cause?: unknown }) {
        super(message, options?.cause != null ? { cause: options.cause } : undefined);
        this.name = "Auth0ManagementError";
        this.errorCode = options?.errorCode;
    }
}

export function getAuth0ManagementClient() {
    if (AUTH0_MANAGEMENT_CLIENT == null) {
        const { AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET } = process.env;

        if (AUTH0_DOMAIN == null) {
            throw new Auth0ManagementError("AUTH0_DOMAIN is not defined", { errorCode: "CONFIG_MISSING" });
        }
        if (AUTH0_CLIENT_ID == null) {
            throw new Auth0ManagementError("AUTH0_CLIENT_ID is not defined", { errorCode: "CONFIG_MISSING" });
        }
        if (AUTH0_CLIENT_SECRET == null) {
            throw new Auth0ManagementError("AUTH0_CLIENT_SECRET is not defined", { errorCode: "CONFIG_MISSING" });
        }

        AUTH0_MANAGEMENT_CLIENT = new ManagementClient({
            domain: AUTH0_DOMAIN,
            clientId: AUTH0_CLIENT_ID,
            clientSecret: AUTH0_CLIENT_SECRET,
            timeoutDuration: 60_000
        });
    }

    return AUTH0_MANAGEMENT_CLIENT;
}

/**********
 * caches *
 **********/

const ORGANIZATIONS_CACHE = new AsyncRedisCache(RedisCacheKeyType.ORGANIZATION, { ttlInSeconds: 300, debug: true });

const ORGANIZATION_NAME_TO_ID_CACHE = new AsyncRedisCache(RedisCacheKeyType.ORGANIZATION_NAME_TO_ID, {
    ttlInSeconds: 300
});

const ORGANIZATION_MEMBERS_CACHE = new AsyncRedisCache(RedisCacheKeyType.ORGANIZATION_MEMBERS, { ttlInSeconds: 60 });

const ORGANIZATION_INVITATIONS_CACHE = new AsyncRedisCache(RedisCacheKeyType.ORGANIZATION_INVITATIONS, {
    ttlInSeconds: 60
});

const USER_ORGANIZATIONS_CACHE = new AsyncRedisCache(RedisCacheKeyType.USER_ORGANIZATIONS, { ttlInSeconds: 60 });

const INVITE_TOKEN_CACHE = new AsyncRedisCache(
    RedisCacheKeyType.INVITE_TOKEN,
    { ttlInSeconds: 24 * 60 * 60 } // 24 hours
);

/**********************
 * cache invalidators *
 **********************/

export async function invalidateCachesAfterAddingOrgMember(userId: Auth0UserID, orgName: Auth0OrgName): Promise<void> {
    await Promise.all([
        ORGANIZATION_MEMBERS_CACHE.invalidate(RedisCacheKey.organizationMembers(orgName)),
        USER_ORGANIZATIONS_CACHE.invalidate(RedisCacheKey.userOrganizations(userId))
    ]);
}

export async function invalidateCachesAfterRemovingOrgMember(
    userId: Auth0UserID,
    orgName: Auth0OrgName
): Promise<void> {
    await Promise.all([
        ORGANIZATION_MEMBERS_CACHE.invalidate(RedisCacheKey.organizationMembers(orgName)),
        USER_ORGANIZATIONS_CACHE.invalidate(RedisCacheKey.userOrganizations(userId))
    ]);
}

export async function invalidateCachesAfterUpdatingMemberRoles(orgName: Auth0OrgName): Promise<void> {
    await ORGANIZATION_MEMBERS_CACHE.invalidate(RedisCacheKey.organizationMembers(orgName));
}

export async function invalidateCachesAfterCreatingInvitation(orgName: Auth0OrgName): Promise<void> {
    await ORGANIZATION_INVITATIONS_CACHE.invalidate(RedisCacheKey.organizationInvitations(orgName));
}

export async function invalidateCachesAfterRescindingInvitation(orgName: Auth0OrgName): Promise<void> {
    await ORGANIZATION_INVITATIONS_CACHE.invalidate(RedisCacheKey.organizationInvitations(orgName));
}

export async function invalidateCachesAfterRedeemingInviteToken(token: string): Promise<void> {
    await INVITE_TOKEN_CACHE.invalidate(RedisCacheKey.inviteToken(token));
}

export async function invalidateCachesAfterUpdatingOrgMetadata(orgName: Auth0OrgName): Promise<void> {
    await Promise.all([
        ORGANIZATIONS_CACHE.invalidate(RedisCacheKey.organization(orgName)),
        redisDel(RedisCacheKey.organizationNotFound(orgName))
    ]);
}

export async function invalidateCachesAfterCreatingOrg(orgName: Auth0OrgName, userId?: Auth0UserID): Promise<void> {
    const invalidations: Promise<unknown>[] = [
        redisDel(RedisCacheKey.organizationNotFound(orgName)),
        ORGANIZATIONS_CACHE.invalidate(RedisCacheKey.organization(orgName)),
        ORGANIZATION_NAME_TO_ID_CACHE.invalidate(RedisCacheKey.organizationNameToId(orgName))
    ];

    if (userId != null) {
        invalidations.push(USER_ORGANIZATIONS_CACHE.invalidate(RedisCacheKey.userOrganizations(userId)));
    }

    await Promise.all(invalidations);
}

async function invalidateAllOrgCaches(orgName: Auth0OrgName, userId?: Auth0UserID) {
    const invalidations = [
        ORGANIZATIONS_CACHE.invalidate(RedisCacheKey.organization(orgName)),
        redisDel(RedisCacheKey.organizationNotFound(orgName)),
        ORGANIZATION_NAME_TO_ID_CACHE.invalidate(RedisCacheKey.organizationNameToId(orgName)),
        ORGANIZATION_MEMBERS_CACHE.invalidate(RedisCacheKey.organizationMembers(orgName)),
        invalidateCachesAfterCreatingInvitation(orgName)
    ];

    if (userId != null) {
        invalidations.push(USER_ORGANIZATIONS_CACHE.invalidate(RedisCacheKey.userOrganizations(userId)));
    }

    await Promise.all(invalidations);
}

/***********
 * helpers *
 ***********/

function hasStatusCode(error: unknown): error is { statusCode: number } {
    return (
        typeof error === "object" &&
        error != null &&
        "statusCode" in error &&
        typeof (error as { statusCode?: unknown }).statusCode === "number"
    );
}

function isOrgNotFoundError(error: unknown): boolean {
    if (!hasStatusCode(error) || error.statusCode !== 404) {
        return false;
    }
    // Auth0 may not give us reliable error codes
    // So we check the error message: "[ManagementApiError]: No organization found by that id"
    const errorMessage = error instanceof Error ? error.message : String(error);
    return (
        errorMessage.toLowerCase().includes("no organization found") ||
        errorMessage.toLowerCase().includes("organization not found")
    );
}

interface Auth0ErrorDetails {
    statusCode?: number;
    message?: string;
    errorCode?: string;
}

function extractErrorDetails(error: unknown): Auth0ErrorDetails {
    const details: Auth0ErrorDetails = {};
    if (hasStatusCode(error)) {
        details.statusCode = error.statusCode;
    }
    if (error instanceof Error) {
        details.message = error.message;
    }
    if (typeof error === "object" && error != null && "errorCode" in error) {
        details.errorCode = String((error as { errorCode?: unknown }).errorCode);
    }
    return details;
}

function logAuth0OrgError(
    operation: string,
    orgIdentifier: { orgName?: Auth0OrgName; orgId?: Auth0OrgID },
    error: unknown
): void {
    const errorDetails = extractErrorDetails(error);
    console.error(`[Auth0 Org Error] Operation: ${operation}`, {
        orgName: orgIdentifier.orgName,
        orgId: orgIdentifier.orgId,
        statusCode: errorDetails.statusCode,
        message: errorDetails.message,
        errorCode: errorDetails.errorCode,
        timestamp: new Date().toISOString()
    });
}

async function getOrgIdFromNameFresh(orgName: Auth0OrgName): Promise<Auth0OrgID> {
    const { data: organization } = await retryWithBackoff(
        async () =>
            await getAuth0ManagementClient().organizations.getByName({
                name: orgName
            }),
        `getOrgIdFromNameFresh(${orgName})`
    );
    return Auth0OrgID(organization.id);
}

/**
 * Retries an org-by-id operation with a fresh org ID when a 404 "org not found" error occurs.
 *
 * 1. Logs the error with detailed context
 * 2. Invalidates all org-related caches (including user-org cache if userId is provided)
 * 3. Re-fetches the org ID by name (bypassing cache)
 * 4. If the ID changed, retries the operation with the fresh ID
 * 5. If the ID is the same, the org is truly deleted - re-throws the error
 */
async function retryWithFreshOrgIdOnNotFound<T>(
    operationName: string,
    orgName: Auth0OrgName,
    fn: (orgId: Auth0OrgID) => Promise<T>,
    userId?: Auth0UserID
): Promise<T> {
    const initialOrgId = await getOrgIdFromName(orgName);
    try {
        return await fn(initialOrgId);
    } catch (error) {
        if (!isOrgNotFoundError(error)) {
            throw error;
        }

        logAuth0OrgError(operationName, { orgName, orgId: initialOrgId }, error);
        console.warn(
            `[retryWithFreshOrgIdOnNotFound] Org not found with cached ID ${initialOrgId}, invalidating caches and retrying for ${orgName}`
        );

        await invalidateAllOrgCaches(orgName, userId);

        const freshOrgId = await getOrgIdFromNameFresh(orgName);
        if (freshOrgId === initialOrgId) {
            console.error(
                `[retryWithFreshOrgIdOnNotFound] Fresh org ID ${freshOrgId} matches stale ID, org may be deleted`
            );
            throw error;
        }

        console.info(`[retryWithFreshOrgIdOnNotFound] Org ID changed from ${initialOrgId} to ${freshOrgId}, retrying`);
        return await fn(freshOrgId);
    }
}

export async function getInviteToken(token: string) {
    return await INVITE_TOKEN_CACHE.getDirectly(RedisCacheKey.inviteToken(token));
}

export async function createInviteToken(
    orgName: Auth0OrgName,
    inviterId: string,
    roles?: ("admin" | "editor" | "viewer" | "cli")[]
) {
    const token = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    const inviteToken: InviteToken = {
        orgName,
        inviterId,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        roles
    };
    await INVITE_TOKEN_CACHE.set(RedisCacheKey.inviteToken(token), inviteToken);

    return { token, expiresAt: expiresAt.toISOString() };
}

async function retryWithBackoff<T>(operation: () => Promise<T>, operationName: string, maxRetries = 3): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error as Error;

            if (hasStatusCode(error) && error.statusCode === 429 && attempt < maxRetries) {
                const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
                console.warn(
                    `[${operationName}] Rate limit hit, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`
                );
                await new Promise((resolve) => setTimeout(resolve, backoffMs));
                continue;
            }

            throw error instanceof Error ? error : new Auth0ManagementError(String(error));
        }
    }

    throw lastError ?? new Auth0ManagementError(`${operationName} failed after ${maxRetries} retries`);
}

export async function getOrganization(orgName: Auth0OrgName) {
    console.debug(`[getOrganization] Fetching organization: ${orgName}`);
    return await ORGANIZATIONS_CACHE.get(RedisCacheKey.organization(orgName), async () => {
        console.debug(`[getOrganization] Cache miss for ${orgName}, fetching from Auth0`);
        const { data: organization } = await retryWithBackoff(
            async () =>
                await getAuth0ManagementClient().organizations.getByName({
                    name: orgName
                }),
            `getOrganization(${orgName})`
        );
        console.debug(`[getOrganization] Successfully fetched organization ${orgName} from Auth0`);

        return convertToAuth0Organization(organization);
    });
}

export async function getOrganizationById(orgId: Auth0OrgID) {
    console.debug(`[getOrganizationById] Fetching organization: ${orgId}`);
    const { data: organization } = await retryWithBackoff(
        async () =>
            await getAuth0ManagementClient().organizations.get({
                id: orgId
            }),
        `getOrganizationById(${orgId})`
    );

    return organization as unknown as Auth0Organization;
}

export async function getOrgIdFromName(orgName: Auth0OrgName) {
    return await ORGANIZATION_NAME_TO_ID_CACHE.get(RedisCacheKey.organizationNameToId(orgName), async () => {
        const { data: organization } = await retryWithBackoff(
            async () =>
                await getAuth0ManagementClient().organizations.getByName({
                    name: orgName
                }),
            `getOrgIdFromName(${orgName})`
        );

        return Auth0OrgID(organization.id);
    });
}

export async function getMyOrganizations(userId: Auth0UserID) {
    return await USER_ORGANIZATIONS_CACHE.get(RedisCacheKey.userOrganizations(userId), async () => {
        console.debug(`[getMyOrganizations] Cache miss for ${userId}, fetching from Auth0`);
        const auth0 = getAuth0ManagementClient();
        const allOrganizations: Auth0Organization[] = [];
        let page = 0;
        const per_page = 50;

        while (true) {
            const { data: organizations } = await retryWithBackoff(
                async () =>
                    await auth0.users.getUserOrganizations({
                        id: userId,
                        page,
                        per_page
                    }),
                `getMyOrganizations(${userId}, page=${page})`
            );
            allOrganizations.push(...organizations.map(convertToAuth0Organization));
            page++;
            if (organizations.length < per_page) {
                break;
            }
        }

        console.debug(
            `[getMyOrganizations] Successfully fetched ${allOrganizations.length} organizations for ${userId} from Auth0`
        );
        return allOrganizations;
    });
}

export async function getOrgMembers(
    orgName: Auth0OrgName,
    { includeFernEmployees }: { includeFernEmployees: boolean }
) {
    let members = await ORGANIZATION_MEMBERS_CACHE.get(RedisCacheKey.organizationMembers(orgName), async () => {
        return await retryWithFreshOrgIdOnNotFound("getAllOrgMembers", orgName, (orgId) => getAllOrgMembers(orgId));
    });
    if (!includeFernEmployees) {
        const isFernEmployee = await createIsFernEmployee();
        members = members.filter((member) => !isFernEmployee(Auth0UserID(member.user_id)));
    }
    return members;
}

async function getAllOrgMembers(orgId: Auth0OrgID) {
    const members: GetMembers200ResponseOneOfInner[] = [];

    const auth0 = getAuth0ManagementClient();

    let pageIndex = 0;
    let page: ApiResponse<GetMembers200ResponseOneOfInner[]>;
    do {
        page = await retryWithBackoff(
            async () =>
                await auth0.organizations.getMembers({
                    id: orgId,
                    page: pageIndex,
                    per_page: 100,
                    fields: "user_id,picture,name,email,roles"
                }),
            `getAllOrgMembers(${orgId}, page=${pageIndex})`
        );
        members.push(...page.data);
        pageIndex++;
    } while (
        page.data.length > 0 &&
        // the auth0 API only supports loading 1,000 users via basic pagination
        members.length < 1000
    );

    members.sort((a, b) => (a.name < b.name ? -1 : 1));

    return members;
}

/**
 * Creates a function to check if a user is a member of the Fern organization.
 * This is used for filtering Fern employees from member lists.
 *
 * Note: For checking if the current user has super-user privileges,
 * use isSuperUser(permissions) instead.
 */
export async function createIsFernOrgMemberChecker(): Promise<(userId: Auth0UserID) => boolean> {
    const fernOrgMembers = await getOrgMembers(FERN_ORG_NAME, {
        includeFernEmployees: true
    });
    const fernMembers = new Set(fernOrgMembers.map((member) => Auth0UserID(member.user_id)));
    return (userId: Auth0UserID) => fernMembers.has(Auth0UserID(userId));
}

/**
 * @deprecated Use isSuperUser(permissions) instead for checking current user privileges.
 * This function is kept for backward compatibility but will be removed.
 */
export async function createIsFernEmployee(): Promise<(userId: Auth0UserID) => boolean> {
    return createIsFernOrgMemberChecker();
}

/**
 * Checks if the current user is a super user based on their session permissions.
 * This replaces the old isFernEmployee check for determining admin privileges.
 */
export function isFernEmployee(permissions: string[]): boolean {
    return isSuperUser(permissions);
}

export async function getOrgInvitations(orgName: Auth0OrgName) {
    return await ORGANIZATION_INVITATIONS_CACHE.get(RedisCacheKey.organizationInvitations(orgName), async () => {
        return await retryWithFreshOrgIdOnNotFound("getAllOrgInvitations", orgName, (orgId) =>
            getAllOrgInvitations(orgId)
        );
    });
}

async function getAllOrgInvitations(orgId: Auth0OrgID) {
    const invitations: GetInvitations200ResponseOneOfInner[] = [];

    const auth0 = getAuth0ManagementClient();

    let pageIndex = 0;
    let page: ApiResponse<GetInvitations200ResponseOneOfInner[]>;
    do {
        page = await retryWithBackoff(
            async () =>
                await auth0.organizations.getInvitations({
                    id: orgId,
                    page: pageIndex,
                    per_page: 100
                }),
            `getAllOrgInvitations(${orgId}, page=${pageIndex})`
        );
        invitations.push(...page.data);
        pageIndex++;
    } while (
        page.data.length > 0 &&
        // the auth0 API only supports loading 1,000 invitations via basic pagination
        invitations.length < 1000
    );

    invitations.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    return invitations;
}

export async function doesOrgExist(orgName: Auth0OrgName) {
    try {
        console.debug(`[doesOrgExist] Checking if organization exists: ${orgName}`);

        const notFoundCacheKey = RedisCacheKey.organizationNotFound(orgName);
        const cachedNotFound = await redisGet(notFoundCacheKey);
        if (cachedNotFound != null) {
            console.debug(`[doesOrgExist] Organization ${orgName} cached as not found`);
            return false;
        }

        const org = await getOrganization(orgName);
        const exists = org != null;
        console.debug(`[doesOrgExist] Organization ${orgName} exists: ${exists}`);
        return exists;
    } catch (error) {
        console.debug(`[doesOrgExist] Error checking organization ${orgName}:`, error);

        if (hasStatusCode(error) && error.statusCode === 404) {
            const notFoundCacheKey = RedisCacheKey.organizationNotFound(orgName);
            await redisSet(notFoundCacheKey, true, { ttlInSeconds: 60 });
        }

        return false;
    }
}

export async function doesUserBelongToOrg(
    userId: Auth0UserID,
    orgName: Auth0OrgName,
    options?: { permissions?: string[] }
) {
    // A super user is considered to be in every org, but we need to check if the org exists
    if (options?.permissions && isSuperUser(options.permissions)) {
        const orgExists = await doesOrgExist(orgName);
        if (!orgExists) {
            return false;
        }
        return true;
    }
    const orgs = await getMyOrganizations(userId);
    return orgs.some((o) => o.name === orgName);
}

export async function getUserIdByEmail(email: string): Promise<Auth0UserID> {
    const auth0 = getAuth0ManagementClient();

    // Find the user by email using the search query
    const users = await auth0.users.getAll({
        q: `email:"${email}"`,
        search_engine: "v3"
    });

    if (users.data.length === 0) {
        throw new Auth0ManagementError(`No user found with email: ${email}`, { errorCode: "USER_NOT_FOUND" });
    }

    if (users.data.length > 1) {
        throw new Auth0ManagementError(`Multiple users found with email: ${email}`, {
            errorCode: "MULTIPLE_USERS_FOUND"
        });
    }

    const user = users.data[0];
    if (!user?.user_id) {
        throw new Auth0ManagementError("User ID not found", { errorCode: "USER_ID_MISSING" });
    }

    return Auth0UserID(user.user_id);
}

export async function addUserToOrg(userId: Auth0UserID, orgName: Auth0OrgName) {
    const auth0 = getAuth0ManagementClient();

    await retryWithFreshOrgIdOnNotFound(
        "addUserToOrg",
        orgName,
        async (orgId) => {
            await auth0.organizations.addMembers({ id: orgId }, { members: [userId] });
        },
        userId
    );

    await invalidateCachesAfterAddingOrgMember(userId, orgName);
}

export async function addUserToOrgById(userId: Auth0UserID, orgId: Auth0OrgID) {
    const auth0 = getAuth0ManagementClient();
    await auth0.organizations.addMembers({ id: orgId }, { members: [userId] });
}

/**
 * Assigns a role to an org member without invalidating their Auth0 sessions.
 * Unlike addRoles from @fern-api/user-permissions, this does NOT delete sessions
 * or refresh tokens, so the user's current session remains valid for silent re-auth.
 *
 * Use this when adding a user to an org and assigning a role in the same flow,
 * since the user will already be redirected through org-scoped auth to get fresh tokens.
 */
export async function assignRoleToOrgMember(userId: Auth0UserID, orgId: Auth0OrgID, roleNames: Roles[]): Promise<void> {
    const auth0 = getAuth0ManagementClient();
    const roleMap = getRoleMapping();
    await auth0.organizations.addMemberRoles(
        { user_id: userId, id: orgId },
        { roles: roleNames.map((roleName) => roleMap[roleName].toString()) }
    );
}

export async function getUserGithubToken(userId: Auth0UserID): Promise<string | undefined> {
    const auth0 = getAuth0ManagementClient();
    const user = (await auth0.users.get({ id: userId })).data;
    return user.identities.find((identity) => identity.provider === "github")?.access_token;
}

export async function getUserGithubUsername(userId: Auth0UserID): Promise<string | undefined> {
    const auth0 = getAuth0ManagementClient();
    const user = (await auth0.users.get({ id: userId })).data;
    const githubIdentity = user.identities.find((identity) => identity.provider === "github");

    if (!githubIdentity) {
        return undefined;
    }

    // The profileData contains the GitHub username in the 'login' field
    const profileData = (githubIdentity as any).profileData;
    if (profileData?.login) {
        return profileData.login;
    }

    // Fallback: if profileData is not available, we need to fetch from GitHub API
    // using the access token
    if (githubIdentity.access_token) {
        try {
            const response = await fetch("https://api.github.com/user", {
                headers: {
                    Authorization: `Bearer ${githubIdentity.access_token}`,
                    Accept: "application/vnd.github.v3+json"
                }
            });
            if (response.ok) {
                const data = await response.json();
                return data.login;
            }
        } catch (error) {
            console.error("Failed to fetch GitHub username:", error);
        }
    }

    return undefined;
}

export async function getAllUsersByEmail(email: string): Promise<Auth0User[]> {
    const auth0 = getAuth0ManagementClient();
    const users = (
        await auth0.usersByEmail.getByEmail({
            email
        })
    ).data;

    return users as Auth0User[];
}

export async function getUserByEmail(email: string): Promise<Auth0User | undefined> {
    const users = await getAllUsersByEmail(email);

    if (users.length === 0) {
        return undefined;
    }

    if (users.length > 1) {
        throw new Auth0ManagementError("More than one user with the same email", {
            errorCode: "MULTIPLE_USERS_FOUND"
        });
    }

    const user = users[0] as Auth0User;

    return user;
}

export async function getUserGoogleOauth2EmailInfo(
    userId: Auth0UserID
): Promise<{ email: string | undefined; isEmailVerified: boolean }> {
    const auth0 = getAuth0ManagementClient();
    const user = (await auth0.users.get({ id: userId })).data;

    // Find the google-oauth2 connection
    const googleIdentity = user.identities?.find((identity) => identity.connection === "google-oauth2");

    // Only return email info if the user has a google-oauth2 connection
    if (googleIdentity == null) {
        return {
            email: undefined,
            isEmailVerified: false
        };
    }

    return {
        email: user.email,
        isEmailVerified: user.email_verified ?? false
    };
}
