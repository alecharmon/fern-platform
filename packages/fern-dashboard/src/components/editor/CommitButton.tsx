"use client";

import { useNavigation } from "@fern-docs/components/navigation";
import * as Sentry from "@sentry/nextjs";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useOrgName } from "@/app/[orgName]/context/OrgNameContext";
import { DEFAULT_COMMIT_MESSAGE, handleCreatePr } from "@/app/services/github/github";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";
import { useBranch } from "@/providers/BranchContext";
import { useIsPreviewMode } from "@/providers/EditorPreviewProvider";
import { useGitHubRepo } from "@/providers/GitHubRepoContext";
import { useGitPrInfo } from "@/providers/GitPRContext";
import { useCommitToGitHubMutation } from "@/state/useCommitToGitHubMutation";
import { useCreateBranchMutation } from "@/state/useCreateBranchMutation";
import type { DocsUrl } from "@/utils/types";
import { GithubLogo } from "../auth/GithubLogo";
import { Button } from "../ui/button";
import { DashboardTooltip } from "./DashboardTooltip";
import {
    ErrorCommitToast,
    ErrorNoBaseBranchToast,
    ErrorNoBranchToast,
    ErrorNoGithubSourceToast,
    SuccessfulCommitToast,
    WarningNoChangesToast
} from "./EditorToasts";

export interface CommitButtonProps {
    onShowCelebrationModal?: (show: boolean) => void;
}

export function CommitButton({ onShowCelebrationModal }: CommitButtonProps) {
    const { isPreviewMode } = useIsPreviewMode();

    if (isPreviewMode) {
        return (
            <CommitButtonUI
                disabled
                loading={false}
                onClick={() => {}}
                tooltipContent="Connect your repository to save your changes"
            />
        );
    }
    return <CommitButtonWithGitHub onShowCelebrationModal={onShowCelebrationModal} />;
}

export function CommitButtonWithGitHub({
    onShowCelebrationModal
}: {
    onShowCelebrationModal?: CommitButtonProps["onShowCelebrationModal"];
}) {
    const orgName = useOrgName();
    const { branch } = useBranch();
    const { owner, repo, baseBranch } = useGitHubRepo();
    const { gitPrUrl, setPrUrl, prTitle, refetchPrData, site } = useGitPrInfo();
    const isEditingDisabled = useEditingDisabled();

    const { files, handleCommitSuccess } = useNavigation();

    const commitMutation = useCommitToGitHubMutation();
    const createBranchMutation = useCreateBranchMutation();

    // Track if this is the first commit in this session
    const hasCommittedRef = useRef(false);

    useEffect(() => {
        // NOTE: This is a temporary solution to persist the PR URL across route changes/refreshes.
        const prUrl = localStorage.getItem(`gitPrUrl-${branch}`);
        if (prUrl) {
            setPrUrl(prUrl);
        }
    }, [branch, setPrUrl]);

    const handleCommitPress = useCallback(async () => {
        if (!owner || !repo) {
            ErrorNoGithubSourceToast();
            return;
        }
        if (!branch) {
            ErrorNoBranchToast();
            return;
        }

        if (!files.hasChangesToCommit) {
            WarningNoChangesToast();
            return;
        }

        try {
            let response = await commitMutation.mutateAsync({
                orgName,
                owner,
                repo,
                site,
                branch,
                message: DEFAULT_COMMIT_MESSAGE,
                files: files.forCommit
            });

            // If commit fails because branch doesn't exist, try creating it first
            if (!response.success && response.error.type === "RESOURCE_NOT_FOUND") {
                if (!baseBranch) {
                    ErrorNoBaseBranchToast();
                    return;
                }

                // Try to create the branch
                const branchResult = await createBranchMutation.mutateAsync({
                    orgName,
                    site: site as DocsUrl,
                    owner,
                    repo,
                    branch,
                    baseBranch
                });

                if (branchResult.success) {
                    // Retry the commit now that branch exists
                    response = await commitMutation.mutateAsync({
                        orgName,
                        owner,
                        repo,
                        site,
                        branch,
                        message: DEFAULT_COMMIT_MESSAGE,
                        files: files.forCommit
                    });
                } else {
                    console.error("[CommitButton] Failed to create branch:", branchResult.error);
                    ErrorCommitToast();
                    return;
                }
            }

            if (response.success) {
                SuccessfulCommitToast();
                handleCommitSuccess();

                // Show celebration modal on first commit
                if (!hasCommittedRef.current) {
                    hasCommittedRef.current = true;
                    onShowCelebrationModal?.(true);
                }
            } else {
                ErrorCommitToast(response.error);
                Sentry.captureException(response.error);
                return;
            }

            if (!gitPrUrl) {
                if (!baseBranch) {
                    ErrorNoBaseBranchToast();
                    return;
                }
                const newPrUrl = await handleCreatePr({
                    orgName,
                    branch,
                    owner,
                    site,
                    repo,
                    baseBranch,
                    title: prTitle == null ? undefined : prTitle,
                    onAiGenerationComplete: refetchPrData
                });
                if (newPrUrl) {
                    setPrUrl(newPrUrl);
                    localStorage.setItem(`gitPrUrl-${branch}`, newPrUrl);
                }
            }
        } catch (error) {
            ErrorCommitToast();
            console.error("[CommitButton] Error committing changes:", error);
            // TODO: Move error reporting into toasts handlers
            Sentry.captureException(error);
        }
    }, [
        branch,
        gitPrUrl,
        setPrUrl,
        prTitle,
        refetchPrData,
        owner,
        site,
        repo,
        baseBranch,
        orgName,
        files.forCommit,
        files.hasChangesToCommit,
        handleCommitSuccess,
        commitMutation,
        createBranchMutation,
        onShowCelebrationModal
    ]);

    const commitDisabledReason = useMemo(() => {
        if (isEditingDisabled) {
            return "Cannot commit when PR is closed or merged";
        }

        if (commitMutation.isPending) {
            return "Disabled while committing";
        }

        if (!files.hasChangesToCommit) {
            return "No changes to commit";
        }

        return null;
    }, [isEditingDisabled, commitMutation.isPending, files.hasChangesToCommit]);

    return (
        <CommitButtonUI
            disabled={commitDisabledReason != null}
            loading={commitMutation.isPending}
            onClick={() => void handleCommitPress()}
            tooltipContent={commitDisabledReason}
        />
    );
}

function CommitButtonUI({
    disabled,
    loading,
    onClick,
    tooltipContent
}: {
    disabled: boolean;
    loading: boolean;
    onClick: () => void;
    tooltipContent: string | null;
}) {
    return (
        <DashboardTooltip content={tooltipContent}>
            <Button loading={loading} disabled={disabled} onClick={onClick}>
                <GithubLogo />
                Commit
            </Button>
        </DashboardTooltip>
    );
}
