"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { getDocsGitUrl } from "@/app/api/get-docs-github-url/route";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { parseGitUrl } from "@/app/services/git-common/url-utils";
import { useValidateGitRepo } from "@/hooks/useValidateGitRepo";
import { ReactQueryKey } from "@/state/queryKeys";
import type { DocsUrl } from "@/utils/types";
import { Note } from "../Note";
import { FinishEditorSetupModal } from "./FinishEditorSetupModal";

interface FinishDocsSetupBannerProps {
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
    gitUrl?: string;
}

export function FinishDocsSetupBanner({ docsUrl, orgName, gitUrl }: FinishDocsSetupBannerProps) {
    const {
        data: githubUrlResponse,
        isLoading: isGithubUrlLoading,
        isFetching: isGithubUrlFetching
    } = useQuery({
        queryKey: ReactQueryKey.docsGithubUrl(docsUrl),
        queryFn: () => DashboardApiClient.getDocsGitUrl({ docsUrl }),
        enabled: true,
        initialData: gitUrl ? ({ success: true, gitUrl } as getDocsGitUrl.Response) : undefined,
        staleTime: 0,
        retry: false
    });

    const resolvedGithubUrl = githubUrlResponse?.success ? githubUrlResponse.gitUrl : gitUrl;
    const { owner, repo, provider, path } = useMemo(() => parseGitUrl(resolvedGithubUrl ?? ""), [resolvedGithubUrl]);

    const { result: validationResult, loading: isLoadingValidation } = useValidateGitRepo({
        enabled: !!owner && !!repo,
        docsUrl,
        owner: owner ?? undefined,
        repo: (provider === "gitlab" ? (path ?? repo) : repo) ?? undefined,
        variant: provider === "unknown" ? "github" : provider
    });

    // We only show the setup banner for GitHub repos for now
    const shouldShowBanner =
        provider !== "gitlab" &&
        !isGithubUrlLoading &&
        !isGithubUrlFetching &&
        !isLoadingValidation &&
        !validationResult?.ok;
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
