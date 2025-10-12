"use client";

import { Cog, Loader2 } from "lucide-react";
import { useState } from "react";

import type { GithubRepoValidationResult } from "@/app/services/dal/github/validators";
import { getRepoDisplayNameFromUrl } from "@/app/services/github/github";
import type { GithubSourceRepo } from "@/app/services/github/types";
import type { DocsUrl } from "@/utils/types";

import { GithubLogo } from "../auth/GithubLogo";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { SetGithubSourcePopover } from "./SetGithubSource";

export interface GithubAuthState {
    validationResult: GithubRepoValidationResult;
    sourceRepo?: GithubSourceRepo;
    isLoading?: boolean;
}

export function GithubSource({
    docsUrl,
    githubUrl,
    isLoading
}: {
    docsUrl: DocsUrl;
    githubUrl?: string;
    isLoading?: boolean;
}) {
    const [isSaving, setIsSaving] = useState(false);
    const [isDomainHovered, setIsDomainHovered] = useState(false);

    return (
        <>
            {isLoading ? (
                <Skeleton className="h-4 w-24" />
            ) : (
                <div className="flex flex-wrap items-center gap-2" onMouseEnter={() => setIsDomainHovered(true)}>
                    <div className="flex items-center gap-2">
                        {githubUrl ? (
                            <>
                                <GithubLogo />
                                <a href={githubUrl} className="dashboard-link" target="_blank">
                                    <span className="truncate">{getRepoDisplayNameFromUrl(githubUrl)}</span>
                                </a>
                                {isDomainHovered && (
                                    <SetGithubSourcePopover docsUrl={docsUrl} setIsSaving={setIsSaving}>
                                        <Button
                                            size={isSaving ? "sm" : "iconSm"}
                                            variant="ghost"
                                            disabled={isSaving}
                                            className="size-4 p-0"
                                        >
                                            {isSaving ? <Loader2 className="animate-spin" /> : <Cog />}
                                        </Button>
                                    </SetGithubSourcePopover>
                                )}
                            </>
                        ) : (
                            <SetGithubSourcePopover docsUrl={docsUrl} setIsSaving={setIsSaving}>
                                <Button size="sm" className="w-fit" variant="outline" disabled={isSaving}>
                                    <span className="text-gray-1100">
                                        <GithubLogo />
                                    </span>
                                    {isSaving ? "Saving..." : "Connect Repo"}
                                </Button>
                            </SetGithubSourcePopover>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
