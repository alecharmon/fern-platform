import type { GetInvitations200ResponseOneOfInner, GetMembers200ResponseOneOfInner } from "auth0";

import type { Auth0OrgID, Auth0OrgName, Auth0Organization } from "../auth0/types";

export interface InviteToken {
    orgName: Auth0OrgName;
    inviterId: string;
    createdAt: string;
    expiresAt: string;
}

export interface GithubPrInfo {
    success: boolean;
    error?: string;
    title?: string;
    prNumber?: number;
    prUrl?: string;
    status?: string;
    draft?: boolean;
    merged?: boolean;
    nodeId?: string;
}

export interface WebAnalyticsData {
    metrics?: {
        visitors: number;
        pageViews: number;
        sessions: number;
    };
    timeSeries?: { date: string; value: number }[];
    topPages?: { path: string; visitors: number; views: number }[];
    topCountries?: { country: string; visitors: number; views: number }[];
    llmFileViews?: { path: string; agentViews: number; humanViews: number }[];
    channels?: { channel: string; visitors: number; views: number }[];
    deviceTypes?: { deviceType: string; visitors: number; views: number }[];
    referringDomains?: { domain: string; visitors: number; views: number }[];
}

export type RedisCacheKey<T extends RedisCacheKeyType> = string & {
    __type: T;
};

export const RedisCacheKeyType = {
    ORGANIZATION: "ORGANIZATION",
    ORGANIZATION_MEMBERS: "ORGANIZATION_MEMBERS",
    ORGANIZATION_INVITATIONS: "ORGANIZATION_INVITATIONS",
    ORGANIZATION_NAME_TO_ID: "ORGANIZATION_NAME_TO_ID",
    INVITE_TOKEN: "INVITE_TOKEN",
    GITHUB_INSTALLATION_ID: "GITHUB_INSTALLATION_ID",
    GITHUB_PR_FOR_BRANCH: "GITHUB_PR_FOR_BRANCH",
    WEB_ANALYTICS: "WEB_ANALYTICS"
} as const;

export type RedisCacheKeyType = (typeof RedisCacheKeyType)[keyof typeof RedisCacheKeyType];

export type RedisCacheDataTypes = {
    [RedisCacheKeyType.ORGANIZATION]: Auth0Organization;
    [RedisCacheKeyType.ORGANIZATION_MEMBERS]: GetMembers200ResponseOneOfInner[];
    [RedisCacheKeyType.ORGANIZATION_INVITATIONS]: GetInvitations200ResponseOneOfInner[];
    [RedisCacheKeyType.ORGANIZATION_NAME_TO_ID]: Auth0OrgID;
    [RedisCacheKeyType.INVITE_TOKEN]: InviteToken;
    [RedisCacheKeyType.GITHUB_INSTALLATION_ID]: number;
    [RedisCacheKeyType.GITHUB_PR_FOR_BRANCH]: GithubPrInfo;
    [RedisCacheKeyType.WEB_ANALYTICS]: WebAnalyticsData;
};

export const RedisCacheKey = {
    organization: (orgName: Auth0OrgName) => cacheKey(RedisCacheKeyType.ORGANIZATION)(`org-${orgName}`),
    organizationMembers: (orgName: Auth0OrgName) =>
        cacheKey(RedisCacheKeyType.ORGANIZATION_MEMBERS)(`org-members-${orgName}`),
    organizationInvitations: (orgName: Auth0OrgName) =>
        cacheKey(RedisCacheKeyType.ORGANIZATION_INVITATIONS)(`org-invitations-${orgName}`),
    organizationNameToId: (orgName: Auth0OrgName) =>
        cacheKey(RedisCacheKeyType.ORGANIZATION_NAME_TO_ID)(`org-name-to-id-${orgName}`),
    inviteToken: (token: string) => cacheKey(RedisCacheKeyType.INVITE_TOKEN)(`invite-token-${token}`),
    githubInstallationId: (owner: string, repo: string) =>
        cacheKey(RedisCacheKeyType.GITHUB_INSTALLATION_ID)(`github-installation-id-${owner}-${repo}`),
    githubPrForBranch: (owner: string, repo: string, branch: string, baseBranch?: string) =>
        cacheKey(RedisCacheKeyType.GITHUB_PR_FOR_BRANCH)(
            `github-pr-${owner}-${repo}-${branch}${baseBranch ? `-base-${baseBranch}` : ""}`
        ),
    webAnalytics: (endpoint: string, domain: string, params: string) =>
        cacheKey(RedisCacheKeyType.WEB_ANALYTICS)(`web-analytics-${endpoint}-${domain}-${params}`)
};

function cacheKey<T extends RedisCacheKeyType>(_type: T) {
    return (key: string) => key as unknown as RedisCacheKey<T>;
}

export type inferCachedData<T extends RedisCacheKeyType> = RedisCacheDataTypes[T];
