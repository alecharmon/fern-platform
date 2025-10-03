import { useQuery } from "@tanstack/react-query";

import { FdrAPI } from "@fern-api/fdr-sdk/client/types";

import { Theme } from "@/app/api/homepage-images/types";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { convertFdrDocsSiteUrlToDocsUrl } from "@/utils/getDocsSiteUrl";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

import { convertQueryResultToLoadable } from "./convertQueryResultToLoadable";
import { ReactQueryKey, inferQueryData } from "./queryKeys";

export function useHomepageImageUrl({ docsSite, theme }: { docsSite: FdrAPI.dashboard.DocsSite; theme: Theme }) {
    const orgName = useOrgNameFromPathname();
    const docsUrls = docsSite.urls.map(convertFdrDocsSiteUrlToDocsUrl);
    const QUERY_KEY = ReactQueryKey.homepageImageUrl({
        orgName,
        docsUrls,
        theme
    });

    return convertQueryResultToLoadable(
        useQuery<inferQueryData<typeof QUERY_KEY>>({
            queryKey: QUERY_KEY,
            queryFn: () =>
                DashboardApiClient.getHomepageImages({
                    orgName,
                    urls: docsUrls,
                    theme
                }),
            retry: false
        })
    );
}
