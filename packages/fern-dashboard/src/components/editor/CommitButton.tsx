"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useOrgName } from "@/app/[orgName]/context/OrgNameContext";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import {
  DEFAULT_COMMIT_MESSAGE,
  handleCreatePr,
} from "@/app/services/github/github";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";
import { useBranch } from "@/providers/BranchContext";
import { useGitHubRepo } from "@/providers/GitHubRepoContext";
import { useGitPrInfo } from "@/providers/GitPRContext";
import { usePages } from "@/providers/PagesStoreContext";

import { GithubLogo } from "../auth/GithubLogo";
import { Button } from "../ui/button";
import { DashboardTooltip } from "./DashboardTooltip";
import {
  ErrorNoBaseBranchToast,
  ErrorNoBranchToast,
  ErrorNoGithubSourceToast,
  ErrorStillSyncingToast,
  SuccessfulCommitToast,
  WarningNoChangesToast,
} from "./EditorToasts";
import { ErrorFullCommitToast } from "./EditorToasts";

export function CommitButton() {
  const {
    changedMdxFiles,
    syncedStatus: mdxSyncedStatus,
    prepareCommit,
    isCommitted,
    handleCommitSuccess,
  } = usePages();
  const { gitPrUrl, setPrUrl, prTitle, refetchPrData, site } = useGitPrInfo();
  const { branch } = useBranch();
  const isEditingDisabled = useEditingDisabled();
  const { owner, repo, baseBranch } = useGitHubRepo();
  const orgName = useOrgName();

  useEffect(() => {
    // NOTE: This is a temporary solution to persist the PR URL across route changes/refreshes.
    const prUrl = localStorage.getItem(`gitPrUrl-${branch}`);
    if (prUrl) {
      setPrUrl(prUrl);
    }
  }, [branch, setPrUrl]);

  const [isCommitting, setIsCommitting] = useState(false);
  const [changesCommitted, setChangesCommitted] = useState(false);

  // Initialize changesCommitted state using PagesStore (delegates to NavigationStore)
  useEffect(() => {
    if (!branch) return;

    // Use PagesStore to determine if changes have been committed (delegates to NavigationStore)
    setChangesCommitted(isCommitted(changedMdxFiles));
  }, [changedMdxFiles, branch, mdxSyncedStatus, isCommitted]);

  const handleCommitPress = useCallback(async () => {
    if (!owner || !repo) {
      ErrorNoGithubSourceToast();
      return;
    }
    if (!branch) {
      ErrorNoBranchToast();
      return;
    }

    // Collect all files to commit using PagesStore (delegates to NavigationStore) including MDX files and docs.yml
    let changedFiles: Record<string, string>;
    let deletedFiles: string[];
    try {
      const commitData = prepareCommit(changedMdxFiles);
      changedFiles = commitData.changedFiles;
      deletedFiles = commitData.deletedFiles;
    } catch (error) {
      ErrorFullCommitToast();
      console.error("Failed to prepare commit:", error);
      return;
    }

    const allFilesToCommit = { ...changedFiles };

    if (
      Object.keys(allFilesToCommit).length === 0 &&
      deletedFiles.length === 0
    ) {
      WarningNoChangesToast();
      return;
    }
    // Only check sync status for files that are actually in changedMdxFiles
    // Client pages from localStorage don't need to be synced since they're already commit-ready
    const filesToCheckForSync = Object.keys(changedMdxFiles);
    if (
      filesToCheckForSync.some(
        (filename) => mdxSyncedStatus[filename] === "SYNCING"
      )
    ) {
      ErrorStillSyncingToast();
      return;
    }
    setIsCommitting(true);
    try {
      const gitFiles = [
        // Files to commit/update
        ...Object.entries(allFilesToCommit).map(([filePath, content]) => ({
          path: `fern/${filePath}`,
          content,
          mode: "100644" as const,
        })),
        // Files to delete
        ...deletedFiles.map((filePath: string) => ({
          path: `fern/${filePath}`,
          delete: true as const,
        })),
      ];

      const response = await DashboardApiClient.postGitCommit({
        orgName,
        owner,
        repo,
        site,
        branch,
        message: DEFAULT_COMMIT_MESSAGE,
        files: gitFiles,
      });
      if (response.success) {
        SuccessfulCommitToast();
        setChangesCommitted(true);

        // Handle commit success through PagesStore (coordinates both stores)
        handleCommitSuccess(allFilesToCommit);
      } else {
        ErrorFullCommitToast();
      }

      if (response.success && !gitPrUrl) {
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
          title: prTitle,
          onAiGenerationComplete: refetchPrData,
        });
        if (newPrUrl) {
          setPrUrl(newPrUrl);
          localStorage.setItem(`gitPrUrl-${branch}`, newPrUrl);
        }
      }
    } catch (error) {
      ErrorFullCommitToast();
      // TODO: Integrate with proper error reporting service (e.g., Sentry)
      console.error("Error committing changes:", error);
    } finally {
      setIsCommitting(false);
    }
  }, [
    branch,
    changedMdxFiles,
    mdxSyncedStatus,
    gitPrUrl,
    setPrUrl,
    prTitle,
    refetchPrData,
    owner,
    site,
    repo,
    baseBranch,
    orgName,
    prepareCommit,
    handleCommitSuccess,
  ]);

  const commitDisabledReason = useMemo(() => {
    if (isEditingDisabled) {
      return "Cannot commit when PR is closed or merged";
    }

    if (isCommitting) {
      return "Disabled while committing";
    }

    const { changedFiles, deletedFiles } = prepareCommit(changedMdxFiles);
    const filesToCommit = { ...changedFiles };

    const hasAnyChanges =
      Object.keys(filesToCommit).length > 0 || deletedFiles.length > 0;

    if (!hasAnyChanges) {
      return "No changes to commit";
    }

    if (changesCommitted) {
      return "Latest changes have been committed";
    }

    // Only check sync status for files that are actually in changedMdxFiles
    // Client pages from localStorage don't need to be synced since they're already commit-ready
    const filesToCheckForSync = Object.keys(changedMdxFiles);
    if (
      filesToCheckForSync.some(
        (filename) => mdxSyncedStatus[filename] === "SYNCING"
      )
    ) {
      return "Commit disabled while changes are syncing";
    }
    return null;
  }, [
    isEditingDisabled,
    isCommitting,
    changedMdxFiles,
    mdxSyncedStatus,
    changesCommitted,
    prepareCommit,
  ]);

  return (
    <DashboardTooltip content={commitDisabledReason}>
      <Button
        loading={isCommitting}
        disabled={!!commitDisabledReason}
        onClick={() => void handleCommitPress()}
      >
        <GithubLogo />
        Commit
      </Button>
    </DashboardTooltip>
  );
}
