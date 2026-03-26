import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { ValidateGitRepo } from "@/app/api/validate-git-repo/route";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import type { DocsUrl } from "@/utils/types";

export type { ValidateGitRepo };

export const useValidateGitRepo = ({
    enabled,
    docsUrl,
    gitUrl,
    refetchInterval = false,
    staleTime = 0
}: {
    enabled: boolean;
    docsUrl: DocsUrl;
    gitUrl?: string;
    refetchInterval?: number | false;
    staleTime?: number;
}) => {
    const queryClient = useQueryClient();

    const {
        data: validationResult,
        isLoading,
        isFetching,
        refetch
    } = useQuery<ValidateGitRepo.Response | null>({
        queryKey: ["git-repo-validation", docsUrl, gitUrl],
        queryFn: async () => {
            if (!gitUrl) {
                return null;
            }
            return await DashboardApiClient.validateGitRepo({
                url: docsUrl,
                gitUrl
            });
        },
        enabled: enabled && !!gitUrl,
        staleTime,
        retry: false,
        refetchInterval,
        refetchIntervalInBackground: true
    });

    const invalidate = useCallback(() => {
        void queryClient.invalidateQueries({
            queryKey: ["git-repo-validation", docsUrl, gitUrl]
        });
    }, [docsUrl, gitUrl, queryClient]);

    return {
        loading: isLoading,
        fetching: isFetching,
        refetch,
        result: validationResult,
        invalidate
    };
};
