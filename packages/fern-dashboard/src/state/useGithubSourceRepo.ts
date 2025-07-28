"use client";

import { useQuery } from "@tanstack/react-query";

import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { DocsUrl } from "@/utils/types";

import { convertQueryResultToLoadable } from "./convertQueryResultToLoadable";
import { ReactQueryKey } from "./queryKeys";

export function useGithubSourceRepo(docsUrl: DocsUrl) {
  const queryKey = ReactQueryKey.githubSourceRepo(docsUrl);

  return convertQueryResultToLoadable(
    useQuery({
      queryKey: queryKey,
      queryFn: () =>
        DashboardApiClient.getDocsGithubSource({
          url: docsUrl,
          skipCache: true,
        }),
    })
  );
}
