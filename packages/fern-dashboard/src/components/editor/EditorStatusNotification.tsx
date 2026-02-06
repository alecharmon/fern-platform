"use client";

import { Lock } from "lucide-react";
import { useMemo } from "react";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";
import { useBranch } from "@/providers/BranchContext";
import { useDevMode } from "@/providers/DevModeProvider";
import { useGitPrStatus } from "@/providers/GitPRContext";
import { LoadingSpinner } from "./LoadingSpinner";

export function EditorStatusNotification() {
    const isEditingDisabled = useEditingDisabled();
    const { loading, prStatus } = useGitPrStatus();
    const { branchFailed, branchFailureReason } = useBranch();
    const { currentPageType, viewOnlyContentLoading } = useDevMode();

    const isViewOnlyPage = currentPageType === "changelog";

    const notificationText = useMemo(() => {
        if (isViewOnlyPage) {
            return viewOnlyContentLoading ? "Loading..." : "View only";
        }
        if (branchFailed) {
            return branchFailureReason ?? "Editor disabled since branch was unable to be created.";
        }
        if (loading || !prStatus) {
            return "Loading...";
        }
        if (prStatus === "closed") {
            return "Editing disabled for closed PRs";
        }
        if (prStatus === "merged") {
            return "Editing disabled for merged PRs";
        }
        return "Editor disabled";
    }, [isViewOnlyPage, viewOnlyContentLoading, prStatus, branchFailed, branchFailureReason, loading]);

    if (isViewOnlyPage) {
        const isLoading = viewOnlyContentLoading;
        return (
            <div className="text-gray-1100 absolute left-[calc(50%-150px)] top-[calc(var(--header-toolbar-height)+var(--header-height)+12px)] z-50 flex w-[300px] justify-center">
                <div className="flex shrink-0 items-center gap-2 rounded-full border border-gray-500 bg-gray-100 px-3 py-1.5">
                    {isLoading ? <LoadingSpinner /> : <Lock className="size-4" />}
                    <div className="text-sm">{notificationText}</div>
                </div>
            </div>
        );
    }

    if (!isEditingDisabled || prStatus === "preview") {
        return null;
    }

    const isLoading = !branchFailed && (loading || !prStatus);

    return (
        <div className="text-gray-1100 absolute left-[calc(50%-150px)] top-[calc(var(--header-toolbar-height)+var(--header-height)+12px)] z-50 flex w-[300px] justify-center">
            <div className="flex shrink-0 items-center gap-2 rounded-full border border-gray-500 bg-gray-100 px-3 py-1.5">
                {isLoading ? <LoadingSpinner /> : <Lock className="size-4" />}
                <div className="text-sm">{notificationText}</div>
            </div>
        </div>
    );
}
