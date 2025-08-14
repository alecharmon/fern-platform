"use client";

import { useQuery } from "@tanstack/react-query";

import { FdrAPI } from "@fern-api/fdr-sdk";
import { Loadable, mapLoadable } from "@fern-ui/loadable";

import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { getDocsSiteUrl } from "@/utils/getDocsSiteUrl";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

import { convertQueryResultToLoadable } from "./convertQueryResultToLoadable";
import { ReactQueryKey } from "./queryKeys";

export function useMyDocsSites() {
  const orgName = useOrgNameFromPathname();
  const result = convertQueryResultToLoadable(
    useQuery({
      queryKey: ReactQueryKey.myDocsSites(orgName),
      queryFn: () => DashboardApiClient.getMyDocsSites({ orgName }),
      retry: (failureCount, _error) => {
        return failureCount < 3;
      },
      retryDelay(failureCount) {
        return failureCount * 1000; // 1 second, 2 seconds, 3 seconds, etc.
      },
      gcTime: 0, // Don't cache failed queries
      staleTime: 10000, // Cache successful results for 10 seconds
    })
  );
  return result;
}

export function useDocsSite(
  docsUrl: string
): Loadable<FdrAPI.dashboard.DocsSite | undefined> {
  const maybeLoadedDocsSites = useMyDocsSites();

  return mapLoadable(maybeLoadedDocsSites, ({ docsSites }) =>
    docsSites.find((docsSite) => getDocsSiteUrl(docsSite) === docsUrl)
  );
}
