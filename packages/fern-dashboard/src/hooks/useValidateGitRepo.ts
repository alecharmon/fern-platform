import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { ValidateGithubRepoAccess } from "@/app/api/validate-github-repo-access/route";
import type { ValidateGitlabRepoAccess } from "@/app/api/validate-gitlab-repo-access/route";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import type { DocsUrl } from "@/utils/types";

export const useValidateGitRepo = ({
    enabled,
    docsUrl,
    owner,
    repo,
    refetchInterval = false,
    variant
}: {
    enabled: boolean;
    docsUrl: DocsUrl;
    owner?: string;
    repo?: string;
    refetchInterval?: number | false;
    variant: "github" | "gitlab";
}) => {
    const queryClient = useQueryClient();

    const {
        data: githubAccessResult,
        isLoading: isLoadingGithubAccess,
        isFetching: isFetchingGithubAccess,
        refetch: refetchGithubAccess
    } = useQuery<ValidateGithubRepoAccess.Response | null>({
        queryKey: ["github-repo-access", docsUrl, owner, repo],
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
        enabled: variant === "github" ? enabled : false,
        staleTime: 0, // Data becomes stale immediately
        retry: false,
        refetchInterval: refetchInterval,
        refetchIntervalInBackground: true
    });

    const {
        data: gitlabAccessResult,
        isLoading: isLoadingGitlabAccess,
        isFetching: isFetchingGitlabAccess,
        refetch: refetchGitlabAccess
    } = useQuery<ValidateGitlabRepoAccess.Response | null>({
        queryKey: ["gitlab-repo-access", docsUrl, owner, repo],
        queryFn: async () => {
            if (!owner || !repo) {
                return null;
            }
            return await DashboardApiClient.validateGitlabRepoAccess({
                url: docsUrl,
                owner: owner,
                repo: repo
            });
        },
        enabled: variant === "gitlab" ? enabled : false,
        staleTime: 0,
        retry: false,
        refetchInterval,
        refetchIntervalInBackground: true
    });

    const invalidate = useCallback(() => {
        if (variant === "github") {
            void queryClient.invalidateQueries({ queryKey: ["github-repo-access", docsUrl, owner, repo] });
        } else {
            void queryClient.invalidateQueries({ queryKey: ["gitlab-repo-access", docsUrl, owner, repo] });
        }
    }, [docsUrl, owner, repo, queryClient, variant]);

    const accessCheckResult = variant === "github" ? githubAccessResult : gitlabAccessResult;
    const isLoading = variant === "github" ? isLoadingGithubAccess : isLoadingGitlabAccess;
    const isFetching = variant === "github" ? isFetchingGithubAccess : isFetchingGitlabAccess;
    const refetch = variant === "github" ? refetchGithubAccess : refetchGitlabAccess;

    return { loading: isLoading, fetching: isFetching, refetch, result: accessCheckResult, invalidate };
};
