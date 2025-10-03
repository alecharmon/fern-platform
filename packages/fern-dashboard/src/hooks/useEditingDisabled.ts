"use client";

import { useBranch } from "@/providers/BranchContext";
import { useGitPrInfo } from "@/providers/GitPRContext";

/**
 * Hook to determine if editing should be disabled based on PR status
 * @returns true if editing should be disabled (PR is closed or merged)
 */
export function useEditingDisabled(): boolean {
    const { prStatus } = useGitPrInfo();
    const { branchFailed } = useBranch();

    return branchFailed || !prStatus || prStatus === "closed" || prStatus === "merged";
}
