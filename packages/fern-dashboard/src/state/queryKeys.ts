import type { getDocsUrlOwner } from "@/app/api/get-docs-url-owner/route";
import type { getMyOrganizations } from "@/app/api/get-my-organizations/route";
import type { getOrgMembers } from "@/app/api/get-org-members/route";
import type { getHomepageImageUrl } from "@/app/api/homepage-images/get/route";
import type { Theme } from "@/app/api/homepage-images/types";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { GithubSourceRepo } from "@/app/services/github/types";
import type { DocsUrl } from "@/utils/types";

import type { OrgInvitation } from "./types";

export type ReactQueryKey<T> = string[] & { __queryData: Awaited<T> };

export const ReactQueryKey = {
    orgInvitations: (orgName: Auth0OrgName) => queryKey<OrgInvitation[]>("org-invitations", orgName),
    orgMembers: (orgName: Auth0OrgName) => queryKey<getOrgMembers.Response>("org-members", orgName),
    myOrganizations: () => queryKey<getMyOrganizations.Response>("my-orgs"),
    homepageImageUrl: ({ orgName, docsUrls, theme }: { orgName: Auth0OrgName; docsUrls: DocsUrl[]; theme: Theme }) =>
        queryKey<getHomepageImageUrl.Response>("homepage-image-url", orgName, ...docsUrls, theme),
    docsUrlOwner: (docsUrl: DocsUrl) => queryKey<getDocsUrlOwner.Response>("docs-url-owner", docsUrl),
    orgSvgLogo: (svgUrl: string) => queryKey<string>("org-svg", svgUrl),
    githubSourceRepo: (githubUrl: string) => queryKey<GithubSourceRepo>("github-source-repo", githubUrl)
} as const;

function queryKey<T>(...key: string[]) {
    const frozenKey = Object.freeze(key);
    return frozenKey as ReactQueryKey<T>;
}

export type inferQueryData<K> = K extends ReactQueryKey<infer T> ? T : never;
