"use client";

import { useBranch } from "@/providers/BranchContext";
import { useGitPrInfo } from "@/providers/GitPRContext";

/**
 * Hook to determine if editing should be disabled based on PR status
 * @returns true if editing should be disabled (PR is closed or merged)
 * Note: In preview mode (prStatus === "preview"), editing is allowed but changes won't be saved
 */
export function useEditingDisabled(): boolean {
    const { prStatus } = useGitPrInfo();
    const { branchFailed } = useBranch();

    // Allow editing in preview mode to let users try the editor
    if (prStatus === "preview") {
        return false;
    }

    return branchFailed || !prStatus || prStatus === "closed" || prStatus === "merged";
}
