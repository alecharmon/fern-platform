"use client";

import { useQuery } from "@tanstack/react-query";

import { Auth0OrgName } from "@/app/services/auth0/types";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { DocsUrl } from "@/utils/types";

import { convertQueryResultToLoadable } from "./convertQueryResultToLoadable";
import { ReactQueryKey } from "./queryKeys";

export function useGithubSourceRepo(docsUrl: DocsUrl, orgName: Auth0OrgName) {
  const queryKey = ReactQueryKey.githubSourceRepo(docsUrl);

  return convertQueryResultToLoadable(
    useQuery({
      queryKey: queryKey,
      queryFn: () =>
        DashboardApiClient.getDocsGithubSource({
          orgName,
          url: docsUrl,
          skipCache: true,
        }),
    })
  );
}
