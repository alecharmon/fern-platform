"use client";

import { redirect } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ArrowLeftIcon, GitBranch, Globe } from "lucide-react";

import {
  ClientPageStorage,
  FernTooltip,
  FernTooltipProvider,
  PageStorage,
  getPageFilename,
  pageDataToMdx,
} from "@fern-docs/components";
import { getLoadableValue } from "@fern-ui/loadable";

import { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import { Auth0OrgName } from "@/app/services/auth0/types";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { handleCreatePr } from "@/app/services/github/github";
import { useBranch } from "@/providers/BranchContext";
import { useGitPrUrl } from "@/providers/GitPRUrlContext";
import { useMdxState } from "@/providers/MdxStateContext";
import { useGithubSourceRepo } from "@/state/useGithubSourceRepo";
import { DocsUrl } from "@/utils/types";

import { GithubLogo } from "../auth/GithubLogo";
import { ProfileImage } from "../layout/ProfileImage";
import { Button } from "../ui/button";
import { DevModeSwitcher } from "./DevModeSwitcher";
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
 * Collects all changes from various sources into a single record
 * @param changedMdxFiles - Files changed in MDX state
 * @param branch - Current branch name
 * @returns Record of all changes keyed by filename
 */
function collectAllChanges(
  changedMdxFiles: Record<string, string>,
  branch: string | null
): Record<string, string> {
  const allChanges: Record<string, string> = { ...changedMdxFiles };

  if (!branch) return allChanges;

  // Add client pages from localStorage
  const clientPages = ClientPageStorage.loadClientPages(branch);
  Object.entries(clientPages).forEach(([_clientNodeId, clientPageData]) => {
    if (clientPageData.pageData && clientPageData.fullSlug?.trim()) {
      const filename = getPageFilename(clientPageData.fullSlug);
      if (!allChanges[filename]) {
        allChanges[filename] = pageDataToMdx(clientPageData.pageData);
      }
    }
  });

  // Add server pages with localStorage changes
  const serverPages = PageStorage.loadPages(branch);
  Object.entries(serverPages).forEach(([filename, pageData]) => {
    if (pageData.pageType === "server" && filename?.trim()) {
      if (!allChanges[filename]) {
        allChanges[filename] = pageDataToMdx(pageData);
      }
    }
  });

  return allChanges;
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

/**
 * Generates a hash from the changes for tracking committed state
 * @param changedMdxFiles - Files changed in MDX state
 * @param branch - Current branch name
 * @returns Hash string representing all changes
 */
function generateChangesHash(
  changedMdxFiles: Record<string, string>,
  branch: string | null
): string {
  const allChanges = collectAllChanges(changedMdxFiles, branch);
  return generateSimpleHash(allChanges);
}

export function HeaderToolbar({
  orgName,
  session,
  docsUrl,
}: {
  orgName: Auth0OrgName;
  session: Auth0SessionData;
  docsUrl: DocsUrl;
}) {
  const { name, picture } = session.user;
  const { changedMdxFiles, mdxSyncedStatus } = useMdxState();
  // NOTE: useGitPrUrl is not fully in use because the Provider keeps unmounting, but this is in the right direction we want to go in
  const { gitPrUrl, setPrUrl } = useGitPrUrl();
  const { branch } = useBranch();
  const githubSource = getLoadableValue(useGithubSourceRepo(docsUrl, orgName));

  // If the github source is not found, redirect to the docs page.
  if (!!githubSource && githubSource.githubUrl == null) {
    redirect(`/${orgName}/docs/${docsUrl}`);
  }

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

    const currentHash = generateChangesHash(changedMdxFiles, branch);
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
    if (githubSource?.owner == null || githubSource.repo == null) {
      ErrorNoGithubSourceToast();
      return;
    }
    if (branch == null) {
      ErrorNoBranchToast();
      return;
    }

    // Collect all files to commit using the utility function
    const allFilesToCommit = collectAllChanges(changedMdxFiles, branch);

    if (Object.keys(allFilesToCommit).length === 0) {
      WarningNoChangesToast();
      return;
    }
    if (Object.values(mdxSyncedStatus).some((status) => status !== "SYNCED")) {
      ErrorStillSyncingToast();
      return;
    }
    setIsCommitting(true);
    try {
      const response = await DashboardApiClient.postGitCommit({
        orgName,
        owner: githubSource.owner,
        repo: githubSource.repo,
        branch,
        message: "Visual Editor: Update",
        files: Object.entries(allFilesToCommit).map(([filePath, content]) => ({
          path: `fern/${filePath}`,
          content,
          mode: "100644",
        })),
      });
      if (response.success) {
        SuccessfulCommitToast();
        setChangesCommitted(true);

        // Store the hash of ALL committed changes (same as what we actually committed)
        // Use the exact same content that was committed to generate the hash
        const committedHash = generateSimpleHash(allFilesToCommit);
        localStorage.setItem(`lastCommittedHash-${branch}`, committedHash);
      } else {
        ErrorFullCommitToast();
      }

      if (response.success && !gitPrUrl) {
        if (githubSource.baseBranch == null) {
          ErrorNoBaseBranchToast();
          return;
        }
        const newPrUrl = await handleCreatePr({
          orgName,
          branch,
          owner: githubSource.owner,
          repo: githubSource.repo,
          baseBranch: githubSource.baseBranch,
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
    orgName,
    githubSource,
    branch,
    changedMdxFiles,
    mdxSyncedStatus,
    gitPrUrl,
    setPrUrl,
  ]);

  const commitDisabledReason = useMemo(() => {
    if (isCommitting) {
      return "Disabled while committing";
    }

    // Check if there are any changes to commit (current changes + localStorage)
    let hasAnyChanges = Object.keys(changedMdxFiles)?.length > 0;

    if (!hasAnyChanges && branch) {
      // Check localStorage for client pages
      const clientPages = ClientPageStorage.loadClientPages(branch);
      hasAnyChanges = Object.keys(clientPages).length > 0;

      // Check localStorage for server pages with changes
      if (!hasAnyChanges) {
        const serverPages = PageStorage.loadPages(branch);
        hasAnyChanges = Object.values(serverPages).some(
          (page) => page.pageType === "server"
        );
      }
    }

    if (!hasAnyChanges) {
      return "No changes to commit";
    }

    if (changesCommitted) {
      return "Latest changes have been committed";
    }

    if (Object.values(mdxSyncedStatus).some((status) => status !== "SYNCED")) {
      return "Commit disabled while changes are syncing";
    }
    return null;
  }, [
    isCommitting,
    changedMdxFiles,
    mdxSyncedStatus,
    branch,
    changesCommitted,
  ]);

  return (
    <div className="bg-background flex h-[var(--header-toolbar-height)] flex-wrap items-center justify-center gap-2 border-b border-gray-500 px-2 py-2 shadow-sm md:py-1">
      <div className="flex flex-1 items-center gap-2 text-left">
        <Button className="px-2" variant="ghost" size="iconSm" asChild>
          <a href={`/${orgName}/docs/${encodeURIComponent(docsUrl)}`}>
            <ArrowLeftIcon />
          </a>
        </Button>
        <div className="flex items-center gap-1 rounded-md p-1 px-2 text-gray-900 transition-colors hover:bg-gray-300 hover:transition-none">
          <a
            href={`https://github.com/${githubSource?.owner}/${githubSource?.repo}/compare/${githubSource?.baseBranch}...${branch}`}
            target="_blank"
            className="flex items-center gap-1"
          >
            <GitBranch className="size-4" />
            <p>{branch}</p>
          </a>
        </div>
      </div>
      {/* TODO: Add undo/redo/settings buttons
       <div className="flex items-center gap-2">
         <ProfileImage
          picture={picture}
          name={name}
          className="ring-primary border-3 border-white ring-2"
        />
        <div className="bg-(--grayscale-a2) border-border rounded-full border px-3 py-0.5">
          <Button
            variant="ghost"
            className="cursor-not-allowed"
            size="iconSm"
            onClick={() => console.log("undo")}
          >
            <ArrowUturnLeftIcon />
          </Button>
          <Button
            variant="ghost"
            className="cursor-not-allowed"
            size="iconSm"
            onClick={() => console.log("redo")}
          >
            <ArrowUturnRightIcon />
          </Button>
          <Button
            variant="ghost"
            className="cursor-not-allowed"
            size="iconSm"
            onClick={() => console.log("settings")}
          >
            <SettingsIcon />
          </Button>
        </div> 
      </div> */}
      <div className="flex flex-1 shrink-0 items-center justify-between gap-3 lg:justify-end">
        <FernTooltipProvider>
          <FernTooltip
            content={"Enable dev mode to edit the source code"}
            delayDuration={400}
            variant="dashboard"
          >
            <div className="pointer-events-auto mr-3 flex items-center justify-center">
              <DevModeSwitcher />
            </div>
          </FernTooltip>
        </FernTooltipProvider>
        {/* TODO: Add preview button functionality */}
        {/* <Button
          variant="ghost"
          size="sm"
          className="text-(--grayscale-a10) cursor-not-allowed"
        >
          <Globe />
          Preview
        </Button> */}
        {/* <Button variant="ghost">Files</Button> */}
        <FernTooltipProvider>
          <FernTooltip
            content={`Editing as ${name}`}
            delayDuration={0}
            variant="dashboard"
          >
            <span className="pointer-events-auto">
              <ProfileImage
                picture={picture}
                name={name}
                className="ring-primary border-3 border-white ring-2"
              />
            </span>
          </FernTooltip>
        </FernTooltipProvider>

        <div className="flex gap-1">
          <FernTooltipProvider>
            <FernTooltip
              content={gitPrUrl ? undefined : "Commit changes to view PR"}
              delayDuration={200}
              variant="dashboard"
            >
              {/* Additional span is needed since disabled buttons don't have pointer events */}
              <span className="pointer-events-auto">
                <Button
                  disabled={!gitPrUrl}
                  variant="ghost"
                  asChild={!!gitPrUrl}
                >
                  <a
                    href={gitPrUrl ?? ""}
                    target="_blank"
                    className="flex items-center gap-2"
                  >
                    <Globe />
                    View PR
                  </a>
                </Button>
              </span>
            </FernTooltip>
          </FernTooltipProvider>
          <FernTooltipProvider>
            <FernTooltip
              content={commitDisabledReason}
              delayDuration={0}
              variant="dashboard"
            >
              <Button
                loading={isCommitting}
                disabled={!!commitDisabledReason}
                onClick={() => void handleCommitPress()}
              >
                <GithubLogo />
                Commit
              </Button>
            </FernTooltip>
          </FernTooltipProvider>
        </div>
      </div>
    </div>
  );
}
