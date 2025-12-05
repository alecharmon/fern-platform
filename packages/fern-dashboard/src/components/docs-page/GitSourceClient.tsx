"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Pencil } from "lucide-react";
import { useState } from "react";

import type { getDocsGitUrl } from "@/app/api/get-docs-github-url/route";
import type { GitRepoValidationResult } from "@/app/services/dal/github/validators";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { getRepoDisplayNameFromUrl } from "@/app/services/github/github";
import type { GitSourceRepo } from "@/app/services/github/types";
import { ReactQueryKey } from "@/state/queryKeys";
import type { DocsUrl } from "@/utils/types";

import { GithubLogo } from "../auth/GithubLogo";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { ConnectGithubRepoButton } from "./ConnectGithubRepoButton";
import { SetGitSourcePopover } from "./SetGitSource";

export interface GitAuthState {
    validationResult: GitRepoValidationResult;
    sourceRepo?: GitSourceRepo;
    isLoading?: boolean;
}

export function GitSourceClient({
    docsUrl,
    gitUrl,
    isLoading
}: {
    docsUrl: DocsUrl;
    gitUrl?: string;
    isLoading?: boolean;
}) {
    const [isSaving, setIsSaving] = useState(false);
    const {
        data: gitUrlResponse,
        isLoading: isGithubUrlLoading,
        isFetching: isGithubUrlFetching
    } = useQuery({
        queryKey: ReactQueryKey.docsGithubUrl(docsUrl),
        queryFn: () => DashboardApiClient.getDocsGitUrl({ docsUrl }),
        enabled: !!docsUrl,
        initialData: gitUrl ? ({ success: true, gitUrl } as getDocsGitUrl.Response) : undefined,
        staleTime: 0,
        retry: false
    });

    const resolvedGitUrl = gitUrlResponse?.success ? gitUrlResponse.gitUrl : undefined;
    const showLoadingState = isLoading || isGithubUrlLoading || isGithubUrlFetching;

    return (
        <>
            {showLoadingState ? (
                <Skeleton className="h-4 w-24" />
            ) : (
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                        {resolvedGitUrl ? (
                            <>
                                <div className="shrink-0">
                                    <GithubLogo />
                                </div>
                                {/* dashboard-link uses inline-flex which prevents truncate from working – block is required for ellipsis */}
                                <a
                                    href={resolvedGitUrl}
                                    className="dashboard-link block! truncate min-w-0"
                                    target="_blank"
                                >
                                    {getRepoDisplayNameFromUrl(resolvedGitUrl)}
                                </a>
                                <div className="shrink-0">
                                    <SetGitSourcePopover
                                        docsUrl={docsUrl}
                                        setIsSaving={setIsSaving}
                                        initialUrl={resolvedGitUrl}
                                    >
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            disabled={isSaving}
                                            className="h-6 px-2 text-xs"
                                        >
                                            {isSaving ? (
                                                <>
                                                    <Loader2 className="mr-1 size-3 animate-spin" />
                                                    Saving...
                                                </>
                                            ) : (
                                                <>
                                                    <Pencil className="mr-1 size-3" />
                                                    Edit
                                                </>
                                            )}
                                        </Button>
                                    </SetGitSourcePopover>
                                </div>
                            </>
                        ) : (
                            <ConnectGithubRepoButton
                                docsUrl={docsUrl}
                                variant="link"
                                buttonText="Connect repo"
                                size="lg"
                                buttonClasses="text-muted-foreground !pl-0 !pr-0 !pt-0 h-fit"
                            />
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
