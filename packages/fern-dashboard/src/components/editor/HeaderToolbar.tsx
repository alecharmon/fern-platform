"use client";

import { redirect } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ArrowLeftIcon, GitBranch, Globe } from "lucide-react";

import { FernTooltipProvider } from "@fern-docs/components";
import { FernTooltip } from "@fern-docs/components";
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
import {
  ErrorNoBaseBranchToast,
  ErrorNoBranchToast,
  ErrorNoGithubSourceToast,
  ErrorStillSyncingToast,
  SuccessfulCommitToast,
  WarningNoChangesToast,
} from "./EditorToasts";
import { ErrorFullCommitToast } from "./EditorToasts";

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

  const handleCommitPress = useCallback(async () => {
    if (githubSource?.owner == null || githubSource.repo == null) {
      ErrorNoGithubSourceToast();
      return;
    }
    if (branch == null) {
      ErrorNoBranchToast();
      return;
    }
    if (Object.keys(changedMdxFiles).length === 0) {
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
        files: Object.entries(changedMdxFiles).map(([filePath, content]) => ({
          path: `fern/${filePath}`,
          content,
          mode: "100644",
        })),
      });
      if (response.success) {
        SuccessfulCommitToast();
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
      console.error("Error committing changes:", error); // TODO: errors should be logged to Sentry, not to console
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
    if (Object.keys(changedMdxFiles)?.length === 0) {
      return "No changes to commit";
    }
    if (Object.values(mdxSyncedStatus).some((status) => status !== "SYNCED")) {
      return "Commit disabled while changes are syncing";
    }
    return null;
  }, [isCommitting, changedMdxFiles, mdxSyncedStatus]);

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
