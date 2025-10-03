"use client";

import { Lock } from "lucide-react";

import { useEditingDisabled } from "@/hooks/useEditingDisabled";
import { useBranch } from "@/providers/BranchContext";
import { useGitPrInfo } from "@/providers/GitPRContext";

export function PreviewOnlyNotification() {
    const isEditingDisabled = useEditingDisabled();
    const { loading, prStatus } = useGitPrInfo();
    const { branchFailed } = useBranch();

    if (!isEditingDisabled) {
        return null;
    }

    const getNotificationText = () => {
        if (branchFailed) {
            return "Editor disabled since branch was not created.";
        }
        if (loading || !prStatus) {
            return "Editor disabled while loading";
        }
        if (prStatus === "closed") {
            return "Editing disabled for closed PRs";
        }
        if (prStatus === "merged") {
            return "Editing disabled for merged PRs";
        }
        return "Editor disabled";
    };

    return (
        <div className="text-gray-1100 absolute left-[calc(50%-150px)] top-[calc(var(--header-toolbar-height)+var(--header-height)+12px)] z-50 flex w-[300px] justify-center">
            <div className="flex shrink-0 items-center gap-2 rounded-full border border-gray-500 bg-gray-100 px-3 py-1.5">
                <Lock className="size-4" />
                <div className="text-sm">{getNotificationText()}</div>
            </div>
        </div>
    );
}
