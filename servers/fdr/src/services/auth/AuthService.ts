import {
    getManagementClientResult,
    getRolesResult,
    hasResourcePermission,
    isSuperUser as isSuperUserFromPermissions
} from "@fern-api/user-permissions";
import { FernVenusApi, FernVenusApiClient } from "@fern-api/venus-api-sdk";
import { ORPCError } from "@orpc/server";
import crypto from "crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type winston from "winston";
import type { FdrApplication, FdrConfig } from "../../app";

/**
 * Simple in-memory cache with TTL for auth results.
 * This helps prevent overwhelming the Venus auth service when
 * many concurrent requests are made for the same user/org combination.
 */
interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

class AuthCache<T> {
    private cache = new Map<string, CacheEntry<T>>();
    private readonly ttlMs: number;
    private readonly maxSize: number;

    constructor(ttlMs: number = 5 * 60 * 1000, maxSize: number = 10000) {
        // Default: 5 minute TTL, max 10k entries
        this.ttlMs = ttlMs;
        this.maxSize = maxSize;
    }

    get(key: string): T | undefined {
        const entry = this.cache.get(key);
        if (entry == null) {
            return undefined;
        }
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return undefined;
        }
        return entry.value;
    }

    set(key: string, value: T): void {
        // Simple eviction: if we hit max size, clear oldest entries
        if (this.cache.size >= this.maxSize) {
            const keysToDelete: string[] = [];
            const now = Date.now();
            // First pass: delete expired entries
            for (const [k, v] of this.cache) {
                if (now > v.expiresAt) {
                    keysToDelete.push(k);
                }
            }
            for (const k of keysToDelete) {
                this.cache.delete(k);
            }
            // If still too big, delete oldest 20%
            if (this.cache.size >= this.maxSize) {
                const deleteCount = Math.ceil(this.maxSize * 0.2);
                const iterator = this.cache.keys();
                for (let i = 0; i < deleteCount; i++) {
                    const result = iterator.next();
                    if (result.done) {
                        break;
                    }
                    this.cache.delete(result.value);
                }
            }
        }
        this.cache.set(key, {
            value,
            expiresAt: Date.now() + this.ttlMs
        });
    }

    clear(): void {
        this.cache.clear();
    }
}

export type OrgIdsResponse = SuccessOrgIdsResponse | ErrorOrgIdsResponse;

export interface SuccessOrgIdsResponse {
    type: "success";
    orgIds: Set<string>;
}

export interface ErrorOrgIdsResponse {
    type: "error";
    err: ORPCError<string, unknown>;
}

export interface AuthService {
    checkUserBelongsToOrg({ authHeader, orgId }: { authHeader: string | undefined; orgId: string }): Promise<void>;

    getUserEmailFromAuthHeader({ authHeader }: { authHeader: string | undefined }): Promise<string | undefined>;

    getOrgIdsFromAuthHeader({ authHeader }: { authHeader: string | undefined }): Promise<OrgIdsResponse>;
    checkOrgHasSnippetsApiAccess({
        authHeader,
        orgId,
        failHard
    }: {
        authHeader: string | undefined;
        orgId: string;
        failHard?: boolean;
    }): Promise<boolean>;
    checkOrgHasSnippetTemplateAccess({
        authHeader,
        orgId,
        failHard
    }: {
        authHeader: string | undefined;
        orgId: string;
        failHard?: boolean;
    }): Promise<boolean>;

    checkUserHasCliPermission({
        authHeader,
        orgId,
        docsUrl
    }: {
        authHeader: string | undefined;
        orgId: string;
        docsUrl?: string;
    }): Promise<void>;
}

/**
 * Cached org feature access information.
 */
interface OrgFeatureAccess {
    snippetsApiAccessEnabled: boolean;
    snippetTemplatesAccessEnabled: boolean;
}

export class AuthServiceImpl implements AuthService {
    private logger: winston.Logger;
    // Cache for org membership checks to prevent overwhelming Venus with concurrent requests
    // Key format: `${tokenHash}:${orgId}`, Value: true (member) or false (not member)
    private orgMembershipCache = new AuthCache<boolean>(5 * 60 * 1000); // 5 minute TTL
    // Cache for super user checks
    private superUserCache = new AuthCache<boolean>(5 * 60 * 1000); // 5 minute TTL
    // Cache for org feature access (snippets, templates, etc.)
    private orgFeatureCache = new AuthCache<OrgFeatureAccess>(5 * 60 * 1000); // 5 minute TTL
    // Track in-flight requests to prevent thundering herd
    private inFlightOrgChecks = new Map<string, Promise<boolean>>();
    private inFlightOrgFeatureChecks = new Map<string, Promise<OrgFeatureAccess>>();

    constructor(private readonly app: FdrApplication) {
        this.logger = app.logger;
    }

    /**
     * Creates a cache key from the auth token and org ID.
     * Uses a simple hash to avoid storing the full token in memory.
     */
    private hashToken(token: string): string {
        return crypto.createHash("sha256").update(token).digest("hex").slice(0, 32);
    }

    private getCacheKey(token: string, orgId: string): string {
        return `${this.hashToken(token)}:${orgId}`;
    }

    /**
     * Creates a cache key for super user check.
     */
    private getSuperUserCacheKey(token: string): string {
        return `su_${this.hashToken(token)}`;
    }

    /**
     * Creates a cache key for org feature access check.
     */
    private getOrgFeatureCacheKey(token: string, orgId: string): string {
        return `orgfeat_${this.hashToken(token)}:${orgId}`;
    }

    /**
     * Gets org feature access from Venus, with caching and thundering herd prevention.
     */
    private async getOrgFeatureAccess(token: string, orgId: string): Promise<OrgFeatureAccess> {
        const cacheKey = this.getOrgFeatureCacheKey(token, orgId);

        // Check cache first
        const cached = this.orgFeatureCache.get(cacheKey);
        if (cached !== undefined) {
            this.logger.debug(`Cache HIT: Org feature access for ${orgId}`);
            return cached;
        }

        // Check for in-flight request
        const inFlightPromise = this.inFlightOrgFeatureChecks.get(cacheKey);
        if (inFlightPromise) {
            this.logger.debug(`Waiting for in-flight org feature check for ${orgId}`);
            return inFlightPromise;
        }

        // Create new request
        const fetchPromise = this.fetchOrgFeatureAccess(token, orgId, cacheKey);
        this.inFlightOrgFeatureChecks.set(cacheKey, fetchPromise);

        try {
            return await fetchPromise;
        } finally {
            this.inFlightOrgFeatureChecks.delete(cacheKey);
        }
    }

    /**
     * Fetches org feature access from Venus.
     */
    private async fetchOrgFeatureAccess(token: string, orgId: string, cacheKey: string): Promise<OrgFeatureAccess> {
        const venus = getVenusClient({
            config: this.app.config,
            token
        });

        const orgResponse = await venus.organization.get(FernVenusApi.OrganizationId(orgId));
        if (!orgResponse.ok) {
            this.logger.error("Failed to make request to venus for org feature access", orgResponse.error);
            throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to resolve organization features" });
        }

        const org = orgResponse.body;
        const featureAccess: OrgFeatureAccess = {
            snippetsApiAccessEnabled: org.snippetsApiAccessEnabled,
            snippetTemplatesAccessEnabled: org.snippetTemplatesAccessEnabled
        };

        // Cache the result
        this.orgFeatureCache.set(cacheKey, featureAccess);

        return featureAccess;
    }

    async getUserEmailFromAuthHeader({ authHeader }: { authHeader: string | undefined }): Promise<string | undefined> {
        if (authHeader == null) {
            return undefined;
        }
        const token = getTokenFromAuthHeader(authHeader);
        const venus = getVenusClient({
            config: this.app.config,
            token
        });
        const response = await venus.user.getMyself();
        if (!response.ok) {
            this.logger.error("Failed to get user from Venus for email lookup", response.error);
            return undefined;
        }
        return response.body.email;
    }

    async getOrgIdsFromAuthHeader({ authHeader }: { authHeader: string | undefined }): Promise<OrgIdsResponse> {
        if (authHeader == null) {
            return {
                type: "error",
                err: new ORPCError("UNAUTHORIZED", { message: "Authorization header was not specified" })
            };
        }
        const token = getTokenFromAuthHeader(authHeader);
        const venus = getVenusClient({
            config: this.app.config,
            token
        });
        const response = await venus.organization.getOrgIdsFromToken();
        if (!response.ok) {
            this.logger.error("Failed to make request to venus", response.error);
            return {
                type: "error",
                err: new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to resolve organizations" })
            };
        }
        this.logger.error(`User belongs to organizations: ${response.body}`);
        return {
            type: "success",
            orgIds: new Set<string>(response.body)
        };
    }

    async checkUserBelongsToOrg({
        authHeader,
        orgId
    }: {
        authHeader: string | undefined;
        orgId: string;
    }): Promise<void> {
        if (authHeader == null) {
            throw new ORPCError("UNAUTHORIZED", { message: "Authorization header was not specified" });
        }
        const token = getTokenFromAuthHeader(authHeader);

        // Check super user cache first
        const superUserCacheKey = this.getSuperUserCacheKey(token);
        let isSuperUserCached = this.superUserCache.get(superUserCacheKey);
        if (isSuperUserCached === undefined) {
            isSuperUserCached = await isSuperUser(token);
            this.superUserCache.set(superUserCacheKey, isSuperUserCached);
        }

        // Check if user has super-user permission - they have access to all orgs
        if (isSuperUserCached) {
            this.logger.debug(`User has super-user permission, granting access to org ${orgId}`);
            return;
        }

        // Check cache for org membership
        const cacheKey = this.getCacheKey(token, orgId);
        const cachedResult = this.orgMembershipCache.get(cacheKey);
        if (cachedResult !== undefined) {
            if (cachedResult) {
                this.logger.debug(`Cache HIT: User belongs to org ${orgId}`);
                return;
            } else {
                this.logger.debug(`Cache HIT: User does not belong to org ${orgId}`);
                throw new ORPCError("FORBIDDEN", { message: "User does not belong to organization" });
            }
        }

        // Check if there's an in-flight requestfor this user/org combination
        // This prevents the "thundering herd" problem where many concurrent requests
        // all hit Venus at the same time
        const inFlightPromise = this.inFlightOrgChecks.get(cacheKey);
        if (inFlightPromise) {
            this.logger.debug(`Waiting for in-flight org membership check for org ${orgId}`);
            const belongsToOrg = await inFlightPromise;
            if (!belongsToOrg) {
                throw new ORPCError("FORBIDDEN", { message: "User does not belong to organization" });
            }
            return;
        }

        // Create a new request and track it
        const checkPromise = this.performOrgMembershipCheck(token, orgId, cacheKey);
        this.inFlightOrgChecks.set(cacheKey, checkPromise);

        try {
            const belongsToOrg = await checkPromise;
            if (!belongsToOrg) {
                throw new ORPCError("FORBIDDEN", { message: "User does not belong to organization" });
            }
        } finally {
            this.inFlightOrgChecks.delete(cacheKey);
        }
    }

    /**
     * Performs the actual org membership check against Venus.
     * Results are cached to prevent repeated calls.
     */
    private async performOrgMembershipCheck(token: string, orgId: string, cacheKey: string): Promise<boolean> {
        const venus = getVenusClient({
            config: this.app.config,
            token
        });

        const response = await venus.organization.isMember(FernVenusApi.OrganizationId(orgId));
        if (!response.ok) {
            this.logger.error("Failed to make request to venus", response.error);
            // Don't cache failures from Venus - the service might be temporarily overwhelmed
            // and we want to retry on subsequent requests
            throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to resolve user's organizations" });
        }

        const belongsToOrg = response.body;

        // Cache the result (both positive and negative)
        this.orgMembershipCache.set(cacheKey, belongsToOrg);

        if (!belongsToOrg) {
            this.logger.warn(`User does not belong to organization: ${orgId}`);
        }

        return belongsToOrg;
    }

    async checkOrgHasSnippetsApiAccess({
        authHeader,
        orgId,
        failHard
    }: {
        authHeader: string | undefined;
        orgId: string;
        failHard?: boolean;
    }): Promise<boolean> {
        if (authHeader == null) {
            throw new ORPCError("UNAUTHORIZED", { message: "Authorization header was not specified" });
        }
        await this.checkUserBelongsToOrg({ authHeader, orgId });
        const token = getTokenFromAuthHeader(authHeader);

        // Use cached org feature access
        const featureAccess = await this.getOrgFeatureAccess(token, orgId);

        if (failHard && !featureAccess.snippetsApiAccessEnabled) {
            throw new ORPCError("UNAUTHORIZED", { message: "Organization does not have snippets API access" });
        }
        return featureAccess.snippetsApiAccessEnabled;
    }

    async checkOrgHasSnippetTemplateAccess({
        authHeader,
        orgId,
        failHard
    }: {
        authHeader: string | undefined;
        orgId: string;
        failHard?: boolean;
    }): Promise<boolean> {
        if (authHeader == null || authHeader.trim() === "") {
            throw new ORPCError("UNAUTHORIZED", {
                message: "No authorization header found. Please provide FERN_TOKEN or run fern login."
            });
        }
        await this.checkUserBelongsToOrg({ authHeader, orgId });
        const token = getTokenFromAuthHeader(authHeader);

        // Use cached org feature access
        const featureAccess = await this.getOrgFeatureAccess(token, orgId);

        if (failHard && !featureAccess.snippetTemplatesAccessEnabled) {
            throw new ORPCError("UNAUTHORIZED", { message: "Organization does not have snippets API access" });
        }
        return featureAccess.snippetTemplatesAccessEnabled;
    }

    async checkUserHasCliPermission({
        authHeader,
        orgId,
        docsUrl
    }: {
        authHeader: string | undefined;
        orgId: string;
        docsUrl?: string;
    }): Promise<void> {
        if (authHeader == null) {
            throw new ORPCError("UNAUTHORIZED", { message: "Authorization header was not specified" });
        }

        const token = getTokenFromAuthHeader(authHeader);

        // Only check CLI permissionsfor Auth0 tokens (JWTs with iss matching AUTH0_DOMAIN).
        // Non-Auth0 tokens (e.g., legacy organization tokens like FERN_TOKEN) are exempt
        // from CLI permission checks to maintain backward compatibility.
        if (!(await isAuth0Token(token))) {
            this.logger.debug(`Skipping CLI permission check for non-Auth0 token for org ${orgId}`);
            return;
        }

        const superUserCacheKey = this.getSuperUserCacheKey(token);
        let isSuperUserCached = this.superUserCache.get(superUserCacheKey);
        if (isSuperUserCached === undefined) {
            isSuperUserCached = await isSuperUser(token);
            this.superUserCache.set(superUserCacheKey, isSuperUserCached);
        }

        if (isSuperUserCached) {
            this.logger.debug(`User has super-user permission, granting access to org ${orgId}`);
            return;
        }

        // Get user ID from Venus
        const venus = getVenusClient({
            config: this.app.config,
            token
        });

        const userResponse = await venus.user.getMyself();
        if (!userResponse.ok) {
            this.logger.error("Failed to get user from Venus", userResponse.error);
            throw new ORPCError("UNAUTHORIZED", { message: "Invalid authorization token" });
        }
        const userId = userResponse.body.userId;

        // Get Auth0 org ID from Fern org name
        let auth0OrgId: string;
        try {
            auth0OrgId = await getAuth0OrgIdFromName(orgId);
        } catch (error) {
            this.logger.error(`Failed to resolve Auth0 org ID for ${orgId}`, error);
            throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to resolve organization" });
        }

        // Get user's roles from Auth0
        const rolesResult = await getRolesResult({ userId, orgId: auth0OrgId });
        if (rolesResult.isErr()) {
            this.logger.error(`Failed to get roles for user ${userId}`, rolesResult.error);
            throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to check user permissions" });
        }

        const userRoles = rolesResult.value.data;

        // Check if user has CLI role at org level
        const hasOrgLevelCli = userRoles.includes("cli") || userRoles.includes("admin");

        if (hasOrgLevelCli) {
            this.logger.debug(`User ${userId} has org-level CLI permission for ${orgId}`);
            return;
        }

        this.logger.warn(
            `[CLI_PERM_CHECK] Will check fine-grained CLI permission for user=${userId}, orgId=${auth0OrgId}, docsUrl=${docsUrl}`
        );

        // If docsUrl is provided (existing site), check fine-grained permissions
        if (docsUrl != null) {
            this.logger.warn(
                `[CLI_PERM_CHECK] Checking fine-grained CLI permission for user=${userId}, orgId=${auth0OrgId}, docsUrl=${docsUrl}`
            );

            const hasFineGrainedCli = await hasResourcePermission({
                sessionPermissions: [],
                userId,
                orgId: auth0OrgId,
                permissionToCheck: "cli",
                resourceType: "docs",
                resourceId: docsUrl,
                forceFineGrained: true,
                logger: this.logger
            });

            this.logger.warn(`[CLI_PERM_CHECK] Result: ${hasFineGrainedCli}`);

            if (hasFineGrainedCli) {
                this.logger.debug(`User ${userId} has fine-grained CLI permission for docs ${docsUrl}`);
                return;
            }
        }

        this.logger.warn(
            `User ${userId} does not have CLI permission for org ${orgId}${docsUrl ? ` or docs ${docsUrl}` : ""}`
        );
        throw new ORPCError("FORBIDDEN", {
            message:
                "You do not have permission to publish documentation. Please contact your organization administrator to request CLI access."
        });
    }
}

function getVenusClient({ config, token }: { config: FdrConfig; token?: string }): FernVenusApiClient {
    return new FernVenusApiClient({
        environment: config.venusUrl,
        token
    });
}

const BEARER_REGEX = /^bearer\s+/i;
export function getTokenFromAuthHeader(authHeader: string) {
    return authHeader.replace(BEARER_REGEX, "");
}

async function getAuth0OrgIdFromName(orgName: string): Promise<string> {
    const clientResult = getManagementClientResult();
    if (clientResult.isErr()) {
        throw new Error(`Auth0 not configured: ${clientResult.error.message}`);
    }
    const client = clientResult.value;
    const { data: organization } = await client.organizations.getByName({
        name: orgName
    });
    return organization.id;
}

/**
 * Gets the Auth0 domain from environment variables.
 * @returns Auth0 domain or undefined if not configured
 */
function getAuth0Domain(): string | undefined {
    return process.env.AUTH0_DOMAIN;
}

/**
 * Constructs the expected Auth0 issuer URL.
 * @param domain - Auth0 domain (e.g., "fern-prod.us.auth0.com")
 * @returns Expected issuer URL (e.g., "https://fern-prod.us.auth0.com/")
 */
function getAuth0Issuer(domain: string): string {
    const protocol = domain.startsWith("localhost") ? "http" : "https";
    return `${protocol}://${domain}/`;
}

/**
 * Creates a JWKS for verifying Auth0 RS256 tokens.
 * @param domain - Auth0 domain
 * @returns JWKS function for jwtVerify
 */
function getAuth0JWKS(domain: string) {
    const protocol = domain.startsWith("localhost") ? "http" : "https";
    const jwksUrl = new URL(`${protocol}://${domain}/.well-known/jwks.json`);
    return createRemoteJWKSet(jwksUrl);
}

/**
 * Verifies an Auth0 JWT token and returns the decoded payload.
 *
 * SECURITY: This function performs cryptographic signature verification
 * to ensure the token is authentic and hasn't been tampered with.
 *
 * @param token - The JWT token string (without Bearer prefix)
 * @returns Verified JWT payload, or null if verification fails
 */
async function verifyAuth0Token(token: string): Promise<import("jose").JWTPayload | null> {
    const auth0Domain = getAuth0Domain();

    if (!auth0Domain) {
        return null;
    }

    try {
        const expectedIssuer = getAuth0Issuer(auth0Domain);
        const JWKS = getAuth0JWKS(auth0Domain);

        const { payload } = await jwtVerify(token, JWKS, {
            issuer: expectedIssuer,
            algorithms: ["RS256"]
        });

        return payload;
    } catch {
        // Verification failed (signature invalid, expired, wrong issuer, etc.)
        return null;
    }
}

/**
 * Checks if a token contains the super-user permission.
 * Super users have access to all organizations.
 *
 * SECURITY: This function verifies the JWT signature before checking permissions
 * to prevent forged tokens from gaining super-user access.
 * Uses RS256 with JWKS for Auth0 user tokens.
 *
 * @param token - The JWT token string (without Bearer prefix)
 * @returns true if the token contains super-user permission, false otherwise
 */
export async function isSuperUser(token: string): Promise<boolean> {
    // Verify the token and get the payload
    const payload = await verifyAuth0Token(token);

    if (!payload) {
        // Token verification failed
        return false;
    }

    // Extract and validate permissions
    const permissions = (payload.permissions as string[] | undefined) ?? [];
    return isSuperUserFromPermissions(permissions);
}

/**
 * Checks if a token is a valid Auth0 JWT by verifying its signature.
 * Auth0 JWTs are verified using the issuer and signature validation.
 * Only verified Auth0 tokens should be subject to CLI permission checks.
 *
 * SECURITY: This function now verifies the JWT signature for better security.
 * Previously it only decoded without verification, which could allow forged tokens
 * to bypass permission checks.
 *
 * @param token - The JWT token string (without Bearer prefix)
 * @returns true if the token is a valid Auth0 JWT, false otherwise
 */
export async function isAuth0Token(token: string): Promise<boolean> {
    // Verify the token - this returns null if it's not a valid Auth0 token
    const payload = await verifyAuth0Token(token);
    return payload !== null;
}
