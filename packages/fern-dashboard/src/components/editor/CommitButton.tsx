"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { FernNavigation } from "@fern-api/fdr-sdk";
import {
  ClientPageStorage,
  CommittedFilesStorage,
  DocsYmlPageEntry,
  DocsYmlStorage,
  PageStorage,
  StoredClientPage,
  getPageFilename,
  pageDataToMdx,
} from "@fern-docs/components";

import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import {
  DEFAULT_COMMIT_MESSAGE,
  handleCreatePr,
} from "@/app/services/github/github";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";
import { useBranch } from "@/providers/BranchContext";
import { useGitHubRepo } from "@/providers/GitHubRepoContext";
import { useGitPrInfo } from "@/providers/GitPRContext";
import { useMdxState } from "@/providers/MdxStateContext";
import {
  addPageToDocsYml,
  pageExistsInNavigation,
  parseYaml,
  removePageFromDocsYml,
} from "@/utils/docsYmlUpdater";

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

/**
 * Finds the section title for a given client page by traversing the navigation
 */
function findSectionForPage(
  clientPageData: StoredClientPage,
  sidebar: FernNavigation.SidebarRootNode | null | undefined
): string | null {
  if (!sidebar?.children || !clientPageData.parentNodeId) {
    return null;
  }

  // Look for the parent section in the sidebar navigation
  for (const child of sidebar.children) {
    if (child.id === clientPageData.parentNodeId && child.type === "section") {
      return child.title;
    }
    // If it's a nested structure, we might need to search deeper
    if (child.children) {
      const found = findSectionInChildren(
        child.children,
        clientPageData.parentNodeId
      );
      if (found) {
        return found;
      }
    }
  }

  return null;
}

/**
 * Recursively searches for a section by ID in navigation children
 */
function findSectionInChildren(
  children: FernNavigation.NavigationNode[],
  parentNodeId: string
): string | null {
  for (const child of children) {
    if (child.id === parentNodeId && child.type === "section") {
      return child.title;
    }
    if ("children" in child && child.children) {
      const found = findSectionInChildren(child.children, parentNodeId);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

/**
 * Collects all changes from various sources into a single record
 * @param changedMdxFiles - Files changed in MDX state
 * @param branch - Current branch name
 * @returns Object containing files to commit and files to delete
 */
function collectAllChanges(
  changedMdxFiles: Record<string, string>,
  branch: string | null
): { filesToCommit: Record<string, string>; filesToDelete: string[] } {
  const filesToCommit: Record<string, string> = { ...changedMdxFiles };
  const filesToDelete: string[] = [];

  if (!branch) return { filesToCommit, filesToDelete: [] };

  // Get previously committed client page files
  const previouslyCommittedFiles =
    CommittedFilesStorage.getCommittedClientPages(branch);
  const currentClientPageFiles = new Set<string>();

  // Get DocsYmlStorage state to check for pending removal operations
  const docsYmlState = DocsYmlStorage.loadState(branch);

  // Add client pages from localStorage
  const clientPages = ClientPageStorage.loadClientPages(branch);
  Object.entries(clientPages).forEach(([_clientNodeId, clientPageData]) => {
    if (clientPageData.pageData && clientPageData.fullSlug?.trim()) {
      const filename = getPageFilename(clientPageData.fullSlug);
      const pagePath = `${clientPageData.fullSlug}.mdx`;

      // Check if this page has a pending removal operation
      const hasRemovalUpdate =
        docsYmlState?.updates[pagePath]?.operation === "remove";

      if (!hasRemovalUpdate) {
        currentClientPageFiles.add(filename);
        if (!filesToCommit[filename]) {
          filesToCommit[filename] = pageDataToMdx(clientPageData.pageData);
        }

        // Note: Docs.yml updates will be handled later based on final commit files
      }
    }
  });

  // Find files that were previously committed but are no longer in ClientPageStorage
  // or have pending removal operations
  for (const previousFile of previouslyCommittedFiles) {
    if (!currentClientPageFiles.has(previousFile)) {
      filesToDelete.push(previousFile);
    }
  }

  // Track page paths for files being deleted (needed for docs.yml updates)
  const filesToDeleteWithPaths: { filename: string; pagePath: string }[] = [];

  // Also add files that have pending removal operations to filesToDelete
  if (docsYmlState) {
    Object.entries(docsYmlState.updates).forEach(([pagePath, update]) => {
      if (update.operation === "remove") {
        const filename = getPageFilename(pagePath.replace(".mdx", ""));
        if (
          !filesToDelete.includes(filename) &&
          previouslyCommittedFiles.has(filename)
        ) {
          filesToDelete.push(filename);
          filesToDeleteWithPaths.push({ filename, pagePath });
        }
      }
    });
  }

  // Don't update committed files tracking yet - that happens after successful commit

  // Add server pages with localStorage changes
  const serverPages = PageStorage.loadPages(branch);
  Object.entries(serverPages).forEach(([filename, pageData]) => {
    if (pageData.pageType === "server" && filename?.trim()) {
      if (!filesToCommit[filename]) {
        filesToCommit[filename] = pageDataToMdx(pageData);
      }
    }
  });

  // Build docs.yml updates based only on files being committed/deleted
  if (docsYmlState?.baseContent) {
    // Preserve removal operations before clearing updates
    const removalOperations: { filename: string; pagePath: string }[] = [];
    if (docsYmlState.updates) {
      Object.entries(docsYmlState.updates).forEach(([pagePath, update]) => {
        if (update.operation === "remove") {
          const filename = getPageFilename(pagePath.replace(".mdx", ""));
          if (filesToDelete.includes(filename)) {
            removalOperations.push({ filename, pagePath });
          }
        }
      });
    }

    // Clear all existing updates and rebuild based on actual commit operations
    DocsYmlStorage.clearAllUpdates(branch);
    DocsYmlStorage.setBaseContent(branch, docsYmlState.baseContent);

    let needsDocsYmlUpdate = false;

    // Add updates for files being committed
    Object.keys(filesToCommit).forEach((filename) => {
      if (filename.endsWith(".mdx")) {
        // This is a page file, find the corresponding client page data
        const clientPages = ClientPageStorage.loadClientPages(branch);
        const clientPageData = Object.values(clientPages).find(
          (page) => getPageFilename(page.fullSlug) === filename
        );

        if (clientPageData) {
          const pagePath = `${clientPageData.fullSlug}.mdx`;

          // Check if this page already exists in base docs.yml
          try {
            const baseDocsConfig = parseYaml(docsYmlState.baseContent);
            const pageAlreadyExists = baseDocsConfig.navigation
              ? pageExistsInNavigation(baseDocsConfig.navigation, pagePath)
              : false;

            if (!pageAlreadyExists) {
              const parentSection = findSectionForPage(
                clientPageData,
                clientPageData.sidebar
              );
              if (parentSection) {
                const pageEntry: DocsYmlPageEntry = {
                  page: clientPageData.node.title,
                  path: pagePath,
                };
                DocsYmlStorage.addUpdate(branch, parentSection, pageEntry);
                needsDocsYmlUpdate = true;
              }
            }
          } catch (error) {
            console.warn(
              "Error checking page existence for docs.yml update:",
              error
            );
          }
        }
      }
    });

    // Add removal updates for files being deleted
    removalOperations.forEach(({ filename, pagePath }) => {
      if (filename.endsWith(".mdx")) {
        DocsYmlStorage.addRemovalUpdate(branch, pagePath);
        needsDocsYmlUpdate = true;
      }
    });

    // Generate final docs.yml content if we have updates
    if (needsDocsYmlUpdate) {
      const finalDocsYmlContent = DocsYmlStorage.getFinalContentWithUpdater(
        branch,
        addPageToDocsYml,
        removePageFromDocsYml
      );
      if (finalDocsYmlContent) {
        filesToCommit["docs.yml"] = finalDocsYmlContent;
      }
    }
  }

  return { filesToCommit, filesToDelete };
}

/**
 * Generates a hash from file content with consistent key ordering
 * @param content - Record of file content keyed by filename
 * @returns Hash string representing the content
 */
function generateSimpleHash(content: Record<string, string>): string {
  // Create a simple hash from the changes with consistent key ordering
  const sortedKeys = Object.keys(content).sort();
  const sortedChanges: Record<string, string> = {};
  sortedKeys.forEach((key) => {
    const value = content[key];
    if (value !== undefined) {
      sortedChanges[key] = value;
    }
  });

  const changeString = JSON.stringify(sortedChanges);
  let hash = 0;
  for (let i = 0; i < changeString.length; i++) {
    const char = changeString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
}

export function CommitButton() {
  const { changedMdxFiles, mdxSyncedStatus } = useMdxState();
  const { gitPrUrl, setPrUrl, prTitle, refetchPrData } = useGitPrInfo();
  const { branch } = useBranch();
  const isEditingDisabled = useEditingDisabled();
  const { owner, repo, baseBranch } = useGitHubRepo();

  useEffect(() => {
    // NOTE: This is a temporary solution to persist the PR URL across route changes/refreshes.
    const prUrl = localStorage.getItem(`gitPrUrl-${branch}`);
    if (prUrl) {
      setPrUrl(prUrl);
    }
  }, [branch, setPrUrl]);

  const [isCommitting, setIsCommitting] = useState(false);
  const [changesCommitted, setChangesCommitted] = useState(false);

  // Initialize changesCommitted state by comparing current changes with last committed hash
  useEffect(() => {
    if (!branch) return;

    // Use the same logic as collectAllChanges to get the complete picture of changes
    const { filesToCommit: allCurrentChanges } = collectAllChanges(
      changedMdxFiles,
      branch
    );
    const currentHash = generateSimpleHash(allCurrentChanges);
    const lastCommittedHash = localStorage.getItem(
      `lastCommittedHash-${branch}`
    );

    // Only set changesCommitted to true if:
    // 1. We have a stored committed hash
    // 2. Current changes hash matches the committed hash
    // 3. There are actually some changes (hash is not for empty state)
    if (
      lastCommittedHash &&
      currentHash === lastCommittedHash &&
      currentHash !== "0"
    ) {
      setChangesCommitted(true);
    } else {
      setChangesCommitted(false);
    }
  }, [changedMdxFiles, branch, mdxSyncedStatus]); // Added mdxSyncedStatus to ensure we wait for data to load

  const handleCommitPress = useCallback(async () => {
    if (!owner || !repo) {
      ErrorNoGithubSourceToast();
      return;
    }
    if (!branch) {
      ErrorNoBranchToast();
      return;
    }

    // Collect all files to commit using the utility function
    const { filesToCommit: allFilesToCommit, filesToDelete } =
      collectAllChanges(changedMdxFiles, branch);

    if (
      Object.keys(allFilesToCommit).length === 0 &&
      filesToDelete.length === 0
    ) {
      WarningNoChangesToast();
      return;
    }
    // Only check sync status for files that are actually in changedMdxFiles
    // Client pages from localStorage don't need to be synced since they're already committed-ready
    const filesToCheckForSync = Object.keys(changedMdxFiles);
    if (
      filesToCheckForSync.some(
        (filename) => mdxSyncedStatus[filename] !== "SYNCED"
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
        ...filesToDelete.map((filePath) => ({
          path: `fern/${filePath}`,
          delete: true as const,
        })),
      ];

      const response = await DashboardApiClient.postGitCommit({
        owner,
        repo,
        branch,
        message: DEFAULT_COMMIT_MESSAGE,
        files: gitFiles,
      });
      if (response.success) {
        SuccessfulCommitToast();
        setChangesCommitted(true);

        // Store the hash of ALL committed changes (same as what we actually committed)
        // Use the exact same content that was committed to generate the hash
        const committedHash = generateSimpleHash(allFilesToCommit);
        localStorage.setItem(`lastCommittedHash-${branch}`, committedHash);

        // Clear docs.yml updates from localStorage since they've been committed
        if (allFilesToCommit["docs.yml"]) {
          DocsYmlStorage.clearAllUpdates(branch);
        }

        // Update committed files tracking after successful commit
        const currentClientPageFiles = new Set<string>();
        const clientPages = ClientPageStorage.loadClientPages(branch);
        Object.entries(clientPages).forEach(
          ([_clientNodeId, clientPageData]) => {
            if (clientPageData.pageData && clientPageData.fullSlug?.trim()) {
              const filename = getPageFilename(clientPageData.fullSlug);
              currentClientPageFiles.add(filename);
            }
          }
        );
        CommittedFilesStorage.setCommittedClientPages(
          branch,
          currentClientPageFiles
        );
      } else {
        ErrorFullCommitToast();
      }

      if (response.success && !gitPrUrl) {
        if (!baseBranch) {
          ErrorNoBaseBranchToast();
          return;
        }
        const newPrUrl = await handleCreatePr({
          branch,
          owner,
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
    repo,
    baseBranch,
  ]);

  const commitDisabledReason = useMemo(() => {
    if (isEditingDisabled) {
      return "Cannot commit when PR is closed or merged";
    }

    if (isCommitting) {
      return "Disabled while committing";
    }

    // Check if there are any changes to commit (current changes + localStorage + deletions)
    let hasAnyChanges = Object.keys(changedMdxFiles).length > 0;

    if (!hasAnyChanges && branch) {
      // Use collectAllChanges to get the complete picture including deletions
      const { filesToCommit, filesToDelete } = collectAllChanges(
        changedMdxFiles,
        branch
      );
      hasAnyChanges =
        Object.keys(filesToCommit).length > 0 || filesToDelete.length > 0;
    }

    if (!hasAnyChanges) {
      return "No changes to commit";
    }

    if (changesCommitted) {
      return "Latest changes have been committed";
    }

    // Only check sync status for files that are actually in changedMdxFiles
    // Client pages from localStorage don't need to be synced since they're already committed-ready
    const filesToCheckForSync = Object.keys(changedMdxFiles);
    if (
      filesToCheckForSync.some(
        (filename) => mdxSyncedStatus[filename] !== "SYNCED"
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
    branch,
    changesCommitted,
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
