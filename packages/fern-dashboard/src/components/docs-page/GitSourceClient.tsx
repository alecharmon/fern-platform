"use client";

import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";

import type { getDocsGitUrl } from "@/app/api/get-docs-github-url/route";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { ValidateGitRepoResult } from "@/app/services/dal/git/validateGitRepoAccess";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { getRepoDisplayNameFromUrl } from "@/app/services/github/github";
import type { GitSourceRepo } from "@/app/services/github/types";
import { ReactQueryKey } from "@/state/queryKeys";
import type { DocsUrl } from "@/utils/types";
import { docsPermissionScope } from "../auth/authz";
import { AuthZWrapper } from "../auth/authz/AuthZWrapper";
import { GithubLogo } from "../auth/GithubLogo";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { FinishEditorSetupModal } from "./visual-editor-section/FinishEditorSetupModal";

export interface GitAuthState {
    validationResult: ValidateGitRepoResult;
    sourceRepo?: GitSourceRepo;
    isLoading?: boolean;
}

export function GitSourceClient({
    docsUrl,
    orgName,
    gitUrl,
    isLoading
}: {
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
    gitUrl?: string;
    isLoading?: boolean;
}) {
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
                                    className="dashboard-link block! min-w-0 truncate"
                                    target="_blank"
                                >
                                    {getRepoDisplayNameFromUrl(resolvedGitUrl)}
                                </a>
                                <AuthZWrapper
                                    permission="manage-settings"
                                    permissionScope={docsPermissionScope(docsUrl)}
                                >
                                    <div className="shrink-0">
                                        <FinishEditorSetupModal
                                            docsUrl={docsUrl}
                                            orgName={orgName}
                                            initialGitUrl={resolvedGitUrl}
                                            trigger={
                                                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
                                                    <Pencil className="mr-1 size-3" />
                                                    Edit
                                                </Button>
                                            }
                                        />
                                    </div>
                                </AuthZWrapper>
                            </>
                        ) : (
                            <FinishEditorSetupModal
                                docsUrl={docsUrl}
                                orgName={orgName}
                                trigger={
                                    <Button
                                        variant="link"
                                        size="lg"
                                        className="text-muted-foreground h-fit !pl-0 !pr-0 !pt-0"
                                    >
                                        <GithubLogo />
                                        Connect repo
                                    </Button>
                                }
                            />
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
