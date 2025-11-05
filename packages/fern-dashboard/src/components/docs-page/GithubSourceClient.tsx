"use client";

import { Loader2, Pencil } from "lucide-react";
import { useState } from "react";

import type { GithubRepoValidationResult } from "@/app/services/dal/github/validators";
import { getRepoDisplayNameFromUrl } from "@/app/services/github/github";
import type { GithubSourceRepo } from "@/app/services/github/types";
import type { DocsUrl } from "@/utils/types";

import { GithubLogo } from "../auth/GithubLogo";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { ConnectGithubRepoButton } from "./ConnectGithubRepoButton";
import { SetGithubSourcePopover } from "./SetGithubSource";

export interface GithubAuthState {
    validationResult: GithubRepoValidationResult;
    sourceRepo?: GithubSourceRepo;
    isLoading?: boolean;
}

export function GithubSourceClient({
    docsUrl,
    githubUrl,
    isLoading
}: {
    docsUrl: DocsUrl;
    githubUrl?: string;
    isLoading?: boolean;
}) {
    const [isSaving, setIsSaving] = useState(false);

    return (
        <>
            {isLoading ? (
                <Skeleton className="h-4 w-24" />
            ) : (
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2">
                        {githubUrl ? (
                            <>
                                <GithubLogo />
                                <a href={githubUrl} className="dashboard-link" target="_blank">
                                    <span className="truncate">{getRepoDisplayNameFromUrl(githubUrl)}</span>
                                </a>
                                <SetGithubSourcePopover
                                    docsUrl={docsUrl}
                                    setIsSaving={setIsSaving}
                                    initialUrl={githubUrl}
                                >
                                    <Button size="sm" variant="ghost" disabled={isSaving} className="h-6 px-2 text-xs">
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
                                </SetGithubSourcePopover>
                            </>
                        ) : (
                            <ConnectGithubRepoButton
                                docsUrl={docsUrl}
                                variant="link"
                                buttonText="Configure GitHub"
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
