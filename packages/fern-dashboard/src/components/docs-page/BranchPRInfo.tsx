"use client";

import { GitPullRequest, GitPullRequestDraft } from "lucide-react";

import type { GithubSourceRepo } from "@/app/services/github/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { GitPRProvider, useGitPrInfo } from "@/providers/GitPRContext";
import type { DocsUrl } from "@/utils/types";

import { ClickablePrNumber } from "../editor/ClickablePrNumber";
import { PRTitleEditor } from "../editor/PRTitleEditor";
import { Skeleton } from "../ui/skeleton";

const getDisplayNameFromBranch = (branch: string) => {
    // Extracts date from branch name format: YYYY-MM-DD-*
    const dateMatch = branch.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!dateMatch) {
        return "Untitled session";
    }

    const [_, year, month, day] = dateMatch;
    return `Untitled session: ${month}-${day}-${year}`;
};

interface BranchPRInfoProps {
    branch: string;
    docsUrl: DocsUrl;
    sourceRepo?: GithubSourceRepo;
}

export function BranchPRInfo({ branch, sourceRepo, docsUrl }: BranchPRInfoProps) {
    if (!sourceRepo?.owner || !sourceRepo?.repo) {
        return null;
    }
    return (
        <GitPRProvider
            owner={sourceRepo.owner}
            repo={sourceRepo.repo}
            branch={branch}
            baseBranch={sourceRepo.baseBranch}
            site={docsUrl}
        >
            <BranchPRContent branch={branch} />
        </GitPRProvider>
    );
}

function BranchPRContent({ branch }: { branch: string }) {
    const { prTitle, gitPrUrl, prStatus, loading, owner, repo } = useGitPrInfo();
    const displayName = prTitle || getDisplayNameFromBranch(branch);

    return (
        <div className="flex items-center gap-2">
            {loading ? (
                <Skeleton className="h-8 w-40" />
            ) : (
                <>
                    {gitPrUrl ? (
                        <>
                            <GitPullRequest className="text-muted-foreground size-4" />
                            <PRTitleEditor
                                owner={owner}
                                repo={repo}
                                branch={branch}
                                gitPrUrl={gitPrUrl}
                                className="max-w-1/2 -ml-1"
                                hideIcon
                            />
                        </>
                    ) : (
                        <>
                            <GitPullRequestDraft className="text-muted-foreground size-4" />
                            <p className="text-muted-foreground ml-1">{displayName}</p>
                        </>
                    )}
                    <ClickablePrNumber />
                    {prTitle && prStatus && <StatusBadge className="h-6 px-2 text-xs" status={prStatus} hideDot />}
                </>
            )}
        </div>
    );
}
