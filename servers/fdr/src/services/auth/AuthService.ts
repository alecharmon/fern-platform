import { getManagementClientResult, getRolesResult, hasResourcePermission } from "@fern-api/user-permissions";
import { FernVenusApi, FernVenusApiClient } from "@fern-api/venus-api-sdk";
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

        // Get user ID from Venus
        const token = getTokenFromAuthHeader(authHeader);
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

        // If docsUrl is provided (existing site), check fine-grained permissions
        if (docsUrl != null) {
            const hasFineGrainedCli = await hasResourcePermission({
                sessionPermissions: [],
                userId,
                orgId: auth0OrgId,
                permissionToCheck: "cli",
                resourceType: "docs",
                resourceId: docsUrl,
                forceFineGrained: true
            });

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
    const { data: organization } = await client.organizations.getByName({ name: orgName });
    return organization.id;
}
