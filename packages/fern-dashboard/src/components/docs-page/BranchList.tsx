"use client";

import { useState } from "react";
import type { GithubSourceRepo } from "@/app/services/github/types";
import { Button } from "@/components/ui/button";
import { useLocalBranches } from "@/hooks/useLocalBranches";
import { useLocalBranchesForSite } from "@/hooks/useLocalBranchesForSite";
import type { DocsUrl } from "@/utils/types";
import { BranchListItem } from "./BranchListItem";

export function BranchList({ docsUrl, sourceRepo }: { docsUrl: DocsUrl; sourceRepo?: GithubSourceRepo }) {
    const [deletedBranches, setDeletedBranches] = useState<Set<string>>(new Set());

    const { deleteBranch, loading } = useLocalBranches();
    const { filteredBranches } = useLocalBranchesForSite(docsUrl);

    // Pagination state
    const [visibleCount, setVisibleCount] = useState(3);
    const BRANCHES_PER_PAGE = 3;

    const handleBranchDelete = (branchName: string) => {
        deleteBranch(branchName);
        setDeletedBranches((prev) => new Set(prev).add(branchName));
        if (visibleCount > filteredBranches.length) {
            setVisibleCount(filteredBranches.length);
        }
    };

    const handleLoadMore = () => {
        setVisibleCount((prev) => Math.min(prev + BRANCHES_PER_PAGE, filteredBranches.length));
    };

    // Filter out deleted branches and get the branches to display (first N branches)
    const availableBranches = filteredBranches.filter((branch) => !deletedBranches.has(branch.branchName));
    const visibleBranches = availableBranches.slice(0, visibleCount);
    const hasMoreBranches = visibleCount < availableBranches.length;

    return (
        <>
            {filteredBranches.length > 0 ? (
                <div className="flex flex-col gap-y-3">
                    {visibleBranches.map((branch, index) => (
                        <BranchListItem
                            key={branch.branchName}
                            branch={branch.branchName}
                            sourceRepo={sourceRepo}
                            docsUrl={docsUrl}
                            handleBranchDelete={handleBranchDelete}
                            showDivider={index < visibleBranches.length - 1}
                        />
                    ))}
                    {hasMoreBranches && (
                        <div className="-mb-2 -ml-1">
                            <Button variant="outline" size="xs" onClick={handleLoadMore}>
                                Show more
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center">
                    <p className="text-muted-foreground">{loading ? "Loading..." : "No open sessions found"}</p>
                </div>
            )}
        </>
    );
}
