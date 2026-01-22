import {
    getManagementClientResult,
    getRolesResult,
    hasResourcePermission,
    isSuperUser as isSuperUserFromPermissions
} from "@fern-api/user-permissions";
import { FernVenusApi, FernVenusApiClient } from "@fern-api/venus-api-sdk";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type winston from "winston";

import type { FernRegistryError } from "../../api/generated";
import {
    UnauthorizedError,
    UnavailableError,
    UserDoesNotHaveCliPermissionError,
    UserNotInOrgError
} from "../../api/generated/api";
import type { FdrApplication, FdrConfig } from "../../app";

export type OrgIdsResponse = SuccessOrgIdsResponse | ErrorOrgIdsResponse;

export interface SuccessOrgIdsResponse {
    type: "success";
    orgIds: Set<string>;
}

export interface ErrorOrgIdsResponse {
    type: "error";
    err: FernRegistryError;
}

export interface AuthService {
    checkUserBelongsToOrg({ authHeader, orgId }: { authHeader: string | undefined; orgId: string }): Promise<void>;

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

export class AuthServiceImpl implements AuthService {
    private logger: winston.Logger;

    constructor(private readonly app: FdrApplication) {
        this.logger = app.logger;
    }

    async getOrgIdsFromAuthHeader({ authHeader }: { authHeader: string | undefined }): Promise<OrgIdsResponse> {
        if (authHeader == null) {
            return {
                type: "error",
                err: new UnauthorizedError("Authorization header was not specified")
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
                err: new UnavailableError("Failed to resolve organizations")
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
            throw new UnauthorizedError("Authorization header was not specified");
        }
        const token = getTokenFromAuthHeader(authHeader);

        // Check if user has super-user permission - they have access to all orgs
        if (await isSuperUser(token)) {
            this.logger.debug(`User has super-user permission, granting access to org ${orgId}`);
            return;
        }

        const venus = getVenusClient({
            config: this.app.config,
            token
        });
        const response = await venus.organization.isMember(FernVenusApi.OrganizationId(orgId));
        if (!response.ok) {
            this.logger.error("Failed to make request to venus", response.error);
            throw new UnavailableError("Failed to resolve user's organizations");
        }
        const belongsToOrg = response.body;

        if (!belongsToOrg) {
            this.logger.warn(`User does not belong to organization: ${orgId}`);
            throw new UserNotInOrgError("User does not belong to organization");
        }
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
            throw new UnauthorizedError("Authorization header was not specified");
        }
        await this.checkUserBelongsToOrg({ authHeader, orgId });
        const token = getTokenFromAuthHeader(authHeader);
        const venus = getVenusClient({
            config: this.app.config,
            token
        });

        const orgResponse = await venus.organization.get(FernVenusApi.OrganizationId(orgId));
        if (!orgResponse.ok) {
            this.logger.error("Failed to make request to venus", orgResponse.error);
            throw new UnavailableError("Failed to resolve user's organizations");
        }
        const org = orgResponse.body;
        if (failHard && !org.snippetsApiAccessEnabled) {
            throw new UnauthorizedError("Organization does not have snippets API access");
        }
        return org.snippetsApiAccessEnabled;
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
            throw new UnauthorizedError("No authorization header found. Please provide FERN_TOKEN or run fern login.");
        }
        await this.checkUserBelongsToOrg({ authHeader, orgId });
        const token = getTokenFromAuthHeader(authHeader);
        const venus = getVenusClient({
            config: this.app.config,
            token
        });
        const orgResponse = await venus.organization.get(FernVenusApi.OrganizationId(orgId));
        if (!orgResponse.ok) {
            this.logger.error("Failed to make request to venus", orgResponse.error);
            throw new UnavailableError(
                `The authorization header does not have access to org=${orgId}. Please reach out to support@buildwithfern.com.`
            );
        }
        const org = orgResponse.body;
        if (failHard && !org.snippetTemplatesAccessEnabled) {
            throw new UnauthorizedError("Organization does not have snippets API access");
        }
        return org.snippetTemplatesAccessEnabled;
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
            throw new UnauthorizedError("Authorization header was not specified");
        }

        const token = getTokenFromAuthHeader(authHeader);

        // Only check CLI permissions for Auth0 tokens (JWTs with iss matching AUTH0_DOMAIN).
        // Non-Auth0 tokens (e.g., legacy organization tokens like FERN_TOKEN) are exempt
        // from CLI permission checks to maintain backward compatibility.
        if (!(await isAuth0Token(token))) {
            this.logger.debug(`Skipping CLI permission check for non-Auth0 token for org ${orgId}`);
            return;
        }

        if (await isSuperUser(token)) {
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
            throw new UnauthorizedError("Invalid authorization token");
        }
        const userId = userResponse.body.userId;

        // Get Auth0 org ID from Fern org name
        let auth0OrgId: string;
        try {
            auth0OrgId = await getAuth0OrgIdFromName(orgId);
        } catch (error) {
            this.logger.error(`Failed to resolve Auth0 org ID for ${orgId}`, error);
            throw new UnavailableError("Failed to resolve organization");
        }

        // Get user's roles from Auth0
        const rolesResult = await getRolesResult({ userId, orgId: auth0OrgId });
        if (rolesResult.isErr()) {
            this.logger.error(`Failed to get roles for user ${userId}`, rolesResult.error);
            throw new UnavailableError("Failed to check user permissions");
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
        throw new UserDoesNotHaveCliPermissionError(
            "You do not have permission to publish documentation. Please contact your organization administrator to request CLI access."
        );
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
    return `https://${domain}/`;
}

/**
 * Creates a JWKS for verifying Auth0 RS256 tokens.
 * @param domain - Auth0 domain
 * @returns JWKS function for jwtVerify
 */
function getAuth0JWKS(domain: string) {
    const jwksUrl = new URL(`https://${domain}/.well-known/jwks.json`);
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
