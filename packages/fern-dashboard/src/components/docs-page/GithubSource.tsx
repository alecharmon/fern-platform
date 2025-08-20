"use client";

import { useState } from "react";

import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { Cog, Loader2, Lock } from "lucide-react";

import { FernTooltip, FernTooltipProvider } from "@fern-docs/components";

import { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import { Auth0OrgName } from "@/app/services/auth0/types";
import { getRepoDisplayNameFromUrl } from "@/app/services/github/github";
import { GithubSourceRepo } from "@/app/services/github/types";
import { DocsUrl } from "@/utils/types";

import { GithubLogo } from "../auth/GithubLogo";
import { Button } from "../ui/button";
import { GoToEditorButton } from "./GoToEditorButton";
import { SetGithubSourcePopover } from "./SetGithubSource";

export interface GithubAuthState {
  repoExists: boolean;
  hasWriteAccess: boolean;
  hasFernBotInstalled: boolean;
  sourceRepo?: GithubSourceRepo;
  isLoading?: boolean;
}

export function GithubSource({
  docsUrl,
  orgName,
  session,
  githubUrl,
  authState,
}: {
  docsUrl: DocsUrl;
  orgName: Auth0OrgName;
  session: Auth0SessionData;
  githubUrl?: string;
  authState: GithubAuthState;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDomainHovered, setIsDomainHovered] = useState(false);

  const {
    repoExists,
    hasWriteAccess,
    hasFernBotInstalled,
    sourceRepo,
    isLoading = false,
  } = authState;

  const disabled =
    isLoading || !repoExists || !hasWriteAccess || !hasFernBotInstalled;

  return (
    <>
      <div
        className="flex flex-wrap items-center gap-2"
        onMouseEnter={() => setIsDomainHovered(true)}
      >
        <div className="flex items-center gap-2">
          {githubUrl ? (
            <>
              <GithubLogo />
              <a href={githubUrl} className="dashboard-link" target="_blank">
                <span className="truncate">
                  {getRepoDisplayNameFromUrl(githubUrl)}
                </span>
              </a>
              {isDomainHovered && (
                <SetGithubSourcePopover
                  docsUrl={docsUrl}
                  setIsSaving={setIsSaving}
                >
                  <Button
                    size={isSaving ? "sm" : "iconSm"}
                    variant="ghost"
                    disabled={isSaving}
                    className="size-4 p-0"
                  >
                    {isSaving ? <Loader2 className="animate-spin" /> : <Cog />}
                  </Button>
                </SetGithubSourcePopover>
              )}
            </>
          ) : (
            <SetGithubSourcePopover docsUrl={docsUrl} setIsSaving={setIsSaving}>
              <Button size="sm" className="w-fit" disabled={isSaving}>
                <GithubLogo />
                {isSaving ? "Saving..." : "Connect Repo"}
              </Button>
            </SetGithubSourcePopover>
          )}
        </div>
      </div>

      <div className="flex flex-row items-center gap-2">
        <GoToEditorButton
          orgName={orgName}
          docsUrl={docsUrl}
          session={session}
          sourceRepo={sourceRepo}
          isValidatingSource={isLoading}
          disabled={disabled}
        />

        {/* Handle displaying reason for disabling GoToEditor button */}
        {!isLoading && disabled && (
          <>
            {!hasFernBotInstalled ? (
              <FernTooltipProvider>
                <FernTooltip
                  content="The Fern Github app is not installed on this repository."
                  variant="dashboard"
                  delayDuration={0}
                  side="bottom"
                  className="bg-gray-1200 rounded-md text-white"
                >
                  <ExclamationCircleIcon className="size-6 text-red-600" />
                </FernTooltip>
              </FernTooltipProvider>
            ) : !repoExists ? (
              <FernTooltipProvider>
                <FernTooltip
                  content="Unable to find this repository."
                  variant="dashboard"
                  delayDuration={0}
                  side="bottom"
                  className="bg-gray-1200 rounded-md text-white"
                >
                  <ExclamationCircleIcon className="size-6 text-red-600" />
                </FernTooltip>
              </FernTooltipProvider>
            ) : !hasWriteAccess ? (
              <FernTooltipProvider>
                <FernTooltip
                  content="You do not have write permission to this repository."
                  variant="dashboard"
                  delayDuration={0}
                  side="bottom"
                  className="bg-gray-1200 rounded-md text-white"
                >
                  <Lock className="text-muted-foreground size-4" />
                </FernTooltip>
              </FernTooltipProvider>
            ) : (
              <></>
            )}
          </>
        )}
      </div>
    </>
  );
}
