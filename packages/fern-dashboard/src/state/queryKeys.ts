import { getDocsGithubSource } from "@/app/api/get-docs-github-source/route";
import { getDocsUrlOwner } from "@/app/api/get-docs-url-owner/route";
import { getMyDocsSites } from "@/app/api/get-my-docs-sites/route";
import { getMyOrganizations } from "@/app/api/get-my-organizations/route";
import { getOrgMembers } from "@/app/api/get-org-members/route";
import { getUserGithubRepos } from "@/app/api/get-user-git-repos/route";
import { getHomepageImageUrl } from "@/app/api/homepage-images/get/route";
import { Theme } from "@/app/api/homepage-images/types";
import { Auth0OrgName } from "@/app/services/auth0/types";
import { DocsUrl } from "@/utils/types";

import { OrgInvitation } from "./types";

export type ReactQueryKey<T> = string[] & { __queryData: Awaited<T> };

export const ReactQueryKey = {
  orgInvitations: (orgName: Auth0OrgName) =>
    queryKey<OrgInvitation[]>("org-invitations", orgName),
  orgMembers: (orgName: Auth0OrgName) =>
    queryKey<getOrgMembers.Response>("org-members", orgName),
  myDocsSites: (
    orgName: Auth0OrgName
  ): ReactQueryKey<getMyDocsSites.Response> =>
    queryKey<getMyDocsSites.Response>("my-docs-sites", orgName),
  myOrganizations: () => queryKey<getMyOrganizations.Response>("my-orgs"),
  homepageImageUrl: ({
    orgName,
    docsUrls,
    theme,
  }: {
    orgName: Auth0OrgName;
    docsUrls: DocsUrl[];
    theme: Theme;
  }) =>
    queryKey<getHomepageImageUrl.Response>(
      "homepage-image-url",
      orgName,
      ...docsUrls,
      theme
    ),
  docsUrlOwner: (docsUrl: DocsUrl) =>
    queryKey<getDocsUrlOwner.Response>("docs-url-owner", docsUrl),
  orgSvgLogo: (svgUrl: string) => queryKey<string>("org-svg", svgUrl),
  userGithubRepos: (orgName: Auth0OrgName, page?: number) =>
    queryKey<getUserGithubRepos.Response>(
      "get-user-git-repos",
      orgName,
      page?.toString() ?? ""
    ),
  githubSourceRepo: (docsUrl: DocsUrl) =>
    queryKey<getDocsGithubSource.Response>("github-source-repo", docsUrl),
} as const;

function queryKey<T>(...key: string[]) {
  const frozenKey = Object.freeze(key);
  return frozenKey as ReactQueryKey<T>;
}

export type inferQueryData<K> = K extends ReactQueryKey<infer T> ? T : never;
