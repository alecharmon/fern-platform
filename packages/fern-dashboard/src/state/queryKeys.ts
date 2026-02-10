import type { getDocsGitUrl } from "@/app/api/get-docs-github-url/route";
import type { getDocsUrlOwner } from "@/app/api/get-docs-url-owner/route";
import type { getMyOrganizations } from "@/app/api/get-my-organizations/route";
import type { getOrgMembers } from "@/app/api/get-org-members/route";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { DocsUrl } from "@/utils/types";

import type { OrgInvitation } from "./types";

export type ReactQueryKey<T> = string[] & { __queryData: Awaited<T> };

export const ReactQueryKey = {
    orgInvitations: (orgName: Auth0OrgName) => queryKey<OrgInvitation[]>("org-invitations", orgName),
    orgMembers: (orgName: Auth0OrgName) => queryKey<getOrgMembers.Response>("org-members", orgName),
    myOrganizations: (orgName?: string) =>
        orgName
            ? queryKey<getMyOrganizations.Response>("my-orgs", orgName)
            : queryKey<getMyOrganizations.Response>("my-orgs"),
    docsUrlOwner: (docsUrl: DocsUrl) => queryKey<getDocsUrlOwner.Response>("docs-url-owner", docsUrl),
    orgSvgLogo: (svgUrl: string) => queryKey<string>("org-svg", svgUrl),
    docsGithubUrl: (docsUrl: DocsUrl) => queryKey<getDocsGitUrl.Response>("github-source-repo", docsUrl)
} as const;

function queryKey<T>(...key: string[]) {
    const frozenKey = Object.freeze(key);
    return frozenKey as ReactQueryKey<T>;
}

export type inferQueryData<K> = K extends ReactQueryKey<infer T> ? T : never;
