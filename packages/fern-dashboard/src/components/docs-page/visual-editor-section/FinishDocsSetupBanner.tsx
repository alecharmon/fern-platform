"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { getDocsGithubUrl } from "@/app/api/get-docs-github-url/route";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { getOwnerAndRepoFromGithubUrl } from "@/app/services/github/github";
import { useValidateGithubRepo } from "@/hooks/useValidateGithubRepo";
import { ReactQueryKey } from "@/state/queryKeys";
import type { DocsUrl } from "@/utils/types";
import { Note } from "../Note";
import { FinishEditorSetupModal } from "./FinishEditorSetupModal";

interface FinishDocsSetupBannerProps {
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
    githubUrl?: string;
}

export function FinishDocsSetupBanner({ docsUrl, orgName, githubUrl }: FinishDocsSetupBannerProps) {
    const {
        data: githubUrlResponse,
        isLoading: isGithubUrlLoading,
        isFetching: isGithubUrlFetching
    } = useQuery({
        queryKey: ReactQueryKey.docsGithubUrl(docsUrl),
        queryFn: () => DashboardApiClient.getDocsGithubUrl({ docsUrl }),
        enabled: true,
        initialData: githubUrl ? ({ success: true, githubUrl } as getDocsGithubUrl.Response) : undefined,
        staleTime: 0,
        retry: false
    });

    const resolvedGithubUrl = githubUrlResponse?.success ? githubUrlResponse.githubUrl : githubUrl;
    const { owner, repo } = useMemo(() => getOwnerAndRepoFromGithubUrl(resolvedGithubUrl ?? ""), [resolvedGithubUrl]);

    const { result: validationResult, loading: isLoadingValidation } = useValidateGithubRepo({
        enabled: !!owner && !!repo,
        docsUrl,
        owner: owner ?? undefined,
        repo: repo ?? undefined
    });

    const shouldShowBanner =
        !isGithubUrlLoading && !isGithubUrlFetching && !isLoadingValidation && !validationResult?.ok;
    const [isAnimatingIn, setIsAnimatingIn] = useState(false);

    useEffect(() => {
        if (!shouldShowBanner) {
            setIsAnimatingIn(false);
            return;
        }
        const frameId = requestAnimationFrame(() => setIsAnimatingIn(true));
        return () => {
            cancelAnimationFrame(frameId);
            setIsAnimatingIn(false);
        };
    }, [shouldShowBanner]);

    if (!shouldShowBanner) {
        return null;
    }

    return (
        <div
            className="overflow-hidden"
            style={{
                maxHeight: isAnimatingIn ? "160px" : "0px",
                opacity: isAnimatingIn ? 1 : 0,
                transition: "max-height 600ms ease, opacity 300ms ease",
                marginTop: isAnimatingIn ? undefined : 0
            }}
        >
            <Note
                className="py-3"
                variant="bold"
                title="Edit your docs like a pro"
                subtitle="Connect your repository to dashboard and turn your Fern Editor changes into real pull requests."
                rightContent={<FinishEditorSetupModal docsUrl={docsUrl} orgName={orgName} />}
            />
        </div>
    );
}
