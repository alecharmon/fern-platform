import type { DashboardDocsSite } from "@fern-api/fdr-sdk/orpc-client";
import type { GetInvitations200ResponseOneOfInner, GetMembers200ResponseOneOfInner } from "auth0";
import type { Auth0Organization, Auth0OrgID, Auth0OrgName } from "../auth0/types";

export interface InviteToken {
    orgName: Auth0OrgName;
    inviterId: string;
    createdAt: string;
    expiresAt: string;
    roles?: ("admin" | "editor" | "viewer" | "cli")[];
}

export interface LoginAttempt {
    email: string;
    connection: string;
    orgId: Auth0OrgID;
    orgName: Auth0OrgName;
    redirectPath: string;
    createdAt: string;
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
    pages404?: { path: string; count: number }[];
    feedback?: {
        date: string;
        location: string;
        wasHelpful: boolean;
        selection: string;
        currentUrl: string;
        device: string;
        browser: string;
        operatingSystem: string;
        userFeedback: string;
    }[];
    hasMore?: boolean;
    apiExplorerRequests?: { host: string; method: string; endpoint: string; name: string; count: number }[];
    providers?: { provider: string; count: number }[];
}

export interface AlgoliaAnalyticsData {
    searchCount?: number;
    noResultsRate?: number;
    clickThroughRate?: number;
    conversionRate?: number;
    searches?: { search: string; count: number; percentage?: number }[];
    totalSearches?: number;
    totalSearchesWithNoResults?: number;
    timeSeries?: { date: string; value: number }[];
}

export interface LinkCheckerJob {
    domain: string;
    totalPages: number;
    links: { url: string; sourcePages: string[] }[];
    cursor: number;
    startTime: number;
    workingLinks: number;
    skippedLinks: number;
}

export interface LinkCheckerScrapeJob {
    domain: string;
    pages: string[];
    links: { url: string; sourcePages: string[] }[];
    cursor: number;
    startTime: number;
}

export interface OnboardingPreCreateStatus {
    status: "pending" | "in_progress" | "completed" | "failed";
    repoUrl?: string;
    repoName?: string;
    fernTokenSet?: boolean;
    error?: string;
    startedAt: number;
    completedAt?: number;
}

export interface UserRecentPath {
    path: string;
    orgName: string;
    updatedAt: string;
}

export type RedisCacheKey<T extends RedisCacheKeyType> = string & {
    __type: T;
};

export const RedisCacheKeyType = {
    ORGANIZATION: "ORGANIZATION",
    ORGANIZATION_MEMBERS: "ORGANIZATION_MEMBERS",
    ORGANIZATION_INVITATIONS: "ORGANIZATION_INVITATIONS",
    ORGANIZATION_NAME_TO_ID: "ORGANIZATION_NAME_TO_ID",
    ORGANIZATION_NOT_FOUND: "ORGANIZATION_NOT_FOUND",
    USER_ORGANIZATIONS: "USER_ORGANIZATIONS",
    INVITE_TOKEN: "INVITE_TOKEN",
    GITHUB_INSTALLATION_ID: "GITHUB_INSTALLATION_ID",
    GITHUB_PR_FOR_BRANCH: "GITHUB_PR_FOR_BRANCH",
    WEB_ANALYTICS: "WEB_ANALYTICS",
    DOCS_SITE_ACCESS: "DOCS_SITE_ACCESS",
    ALGOLIA_ANALYTICS: "ALGOLIA_ANALYTICS",
    LINK_CHECKER_JOB: "LINK_CHECKER_JOB",
    LINK_CHECKER_SCRAPE_JOB: "LINK_CHECKER_SCRAPE_JOB",
    USER_SESSION_INVALIDATED: "USER_SESSION_INVALIDATED",
    ONBOARDING_PRE_CREATE: "ONBOARDING_PRE_CREATE",
    LOGIN_ATTEMPT: "LOGIN_ATTEMPT",
    USER_RECENT_PATH: "USER_RECENT_PATH"
} as const;

export type RedisCacheKeyType = (typeof RedisCacheKeyType)[keyof typeof RedisCacheKeyType];

export type RedisCacheDataTypes = {
    [RedisCacheKeyType.ORGANIZATION]: Auth0Organization;
    [RedisCacheKeyType.ORGANIZATION_MEMBERS]: GetMembers200ResponseOneOfInner[];
    [RedisCacheKeyType.ORGANIZATION_INVITATIONS]: GetInvitations200ResponseOneOfInner[];
    [RedisCacheKeyType.ORGANIZATION_NAME_TO_ID]: Auth0OrgID;
    [RedisCacheKeyType.ORGANIZATION_NOT_FOUND]: boolean;
    [RedisCacheKeyType.USER_ORGANIZATIONS]: Auth0Organization[];
    [RedisCacheKeyType.INVITE_TOKEN]: InviteToken;
    [RedisCacheKeyType.GITHUB_INSTALLATION_ID]: number;
    [RedisCacheKeyType.GITHUB_PR_FOR_BRANCH]: GithubPrInfo;
    [RedisCacheKeyType.WEB_ANALYTICS]: WebAnalyticsData;
    [RedisCacheKeyType.DOCS_SITE_ACCESS]: DashboardDocsSite;
    [RedisCacheKeyType.ALGOLIA_ANALYTICS]: AlgoliaAnalyticsData;
    [RedisCacheKeyType.LINK_CHECKER_JOB]: LinkCheckerJob;
    [RedisCacheKeyType.LINK_CHECKER_SCRAPE_JOB]: LinkCheckerScrapeJob;
    [RedisCacheKeyType.USER_SESSION_INVALIDATED]: boolean;
    [RedisCacheKeyType.ONBOARDING_PRE_CREATE]: OnboardingPreCreateStatus;
    [RedisCacheKeyType.LOGIN_ATTEMPT]: LoginAttempt;
    [RedisCacheKeyType.USER_RECENT_PATH]: UserRecentPath;
};

export const RedisCacheKey = {
    organization: (orgName: Auth0OrgName) => cacheKey(RedisCacheKeyType.ORGANIZATION)(`org-${orgName}`),
    organizationMembers: (orgName: Auth0OrgName) =>
        cacheKey(RedisCacheKeyType.ORGANIZATION_MEMBERS)(`org-members-${orgName}`),
    organizationInvitations: (orgName: Auth0OrgName) =>
        cacheKey(RedisCacheKeyType.ORGANIZATION_INVITATIONS)(`org-invitations-${orgName}`),
    organizationNameToId: (orgName: Auth0OrgName) =>
        cacheKey(RedisCacheKeyType.ORGANIZATION_NAME_TO_ID)(`org-name-to-id-${orgName}`),
    organizationNotFound: (orgName: Auth0OrgName) =>
        cacheKey(RedisCacheKeyType.ORGANIZATION_NOT_FOUND)(`org:not_found:${orgName}`),
    userOrganizations: (userId: string) => cacheKey(RedisCacheKeyType.USER_ORGANIZATIONS)(`user-orgs-${userId}`),
    inviteToken: (token: string) => cacheKey(RedisCacheKeyType.INVITE_TOKEN)(`invite-token-${token}`),
    githubInstallationId: (owner: string, repo: string) =>
        cacheKey(RedisCacheKeyType.GITHUB_INSTALLATION_ID)(`github-installation-id-${owner}-${repo}`),
    githubPrForBranch: (owner: string, repo: string, branch: string, baseBranch?: string) =>
        cacheKey(RedisCacheKeyType.GITHUB_PR_FOR_BRANCH)(
            `github-pr-${owner}-${repo}-${branch}${baseBranch ? `-base-${baseBranch}` : ""}`
        ),
    webAnalytics: (endpoint: string, domain: string, params: string) =>
        cacheKey(RedisCacheKeyType.WEB_ANALYTICS)(`web-analytics-${endpoint}-${domain}-${params}`),
    docsSiteAccess: (domain: string) => cacheKey(RedisCacheKeyType.DOCS_SITE_ACCESS)(`docs-site-access-${domain}`),
    algoliaAnalytics: (endpoint: string, params: string) =>
        cacheKey(RedisCacheKeyType.ALGOLIA_ANALYTICS)(`algolia-analytics-${endpoint}-${params}`),
    linkCheckerJob: (jobId: string) => cacheKey(RedisCacheKeyType.LINK_CHECKER_JOB)(`link-checker-job-${jobId}`),
    linkCheckerScrapeJob: (jobId: string) =>
        cacheKey(RedisCacheKeyType.LINK_CHECKER_SCRAPE_JOB)(`link-checker-scrape-job-${jobId}`),
    userSessionInvalidated: (userId: string) =>
        cacheKey(RedisCacheKeyType.USER_SESSION_INVALIDATED)(`user-session-invalidated-${userId}`),
    onboardingPreCreate: (orgName: string) =>
        cacheKey(RedisCacheKeyType.ONBOARDING_PRE_CREATE)(`onboarding-pre-create-${orgName}`),
    loginAttempt: (id: string) => cacheKey(RedisCacheKeyType.LOGIN_ATTEMPT)(`login-attempt-${id}`),
    userRecentPath: (userId: string) => cacheKey(RedisCacheKeyType.USER_RECENT_PATH)(`user-recent-path-${userId}`)
};

function cacheKey<T extends RedisCacheKeyType>(_type: T) {
    return (key: string) => key as unknown as RedisCacheKey<T>;
}

export type inferCachedData<T extends RedisCacheKeyType> = RedisCacheDataTypes[T];
