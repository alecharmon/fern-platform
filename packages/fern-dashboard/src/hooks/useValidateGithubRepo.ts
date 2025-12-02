import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { ValidateGithubRepoAccess } from "@/app/api/validate-github-repo-access/route";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import type { DocsUrl } from "@/utils/types";

export const useValidateGithubRepo = ({
    enabled,
    docsUrl,
    owner,
    repo,
    refetchInterval = false
}: {
    enabled: boolean;
    docsUrl: DocsUrl;
    owner?: string;
    repo?: string;
    refetchInterval?: number | false;
}) => {
    const queryClient = useQueryClient();

    const {
        data: accessCheckResult,
        isLoading,
        isFetching,
        refetch
    } = useQuery<ValidateGithubRepoAccess.Response | null>({
        queryKey: ["validate-github-repo", docsUrl, owner, repo],
        queryFn: async () => {
            if (!owner || !repo) {
                return null;
            }
            return await DashboardApiClient.validateGithubRepoAccess({
                url: docsUrl,
                owner,
                repo
            });
        },
        enabled,
        staleTime: 0, // Data becomes stale immediately
        retry: false,
        refetchInterval: refetchInterval,
        refetchIntervalInBackground: true
    });

    const invalidate = useCallback(() => {
        void queryClient.invalidateQueries({ queryKey: ["validate-github-repo", docsUrl, owner, repo] });
    }, [docsUrl, owner, repo, queryClient]);

    return { loading: isLoading, fetching: isFetching, refetch, result: accessCheckResult, invalidate };
};
