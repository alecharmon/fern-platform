"use client";

import { useState } from "react";

import { Cog, Loader2 } from "lucide-react";

import { getRepoDisplayNameFromUrl } from "@/app/services/github/github";
import { GithubSourceRepo } from "@/app/services/github/types";
import { DocsUrl } from "@/utils/types";

import { GithubLogo } from "../auth/GithubLogo";
import { Button } from "../ui/button";
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
  githubUrl,
}: {
  docsUrl: DocsUrl;
  githubUrl?: string;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDomainHovered, setIsDomainHovered] = useState(false);

  return (
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
            <Button
              size="sm"
              className="w-fit"
              variant="outline"
              disabled={isSaving}
            >
              <GithubLogo />
              {isSaving ? "Saving..." : "Connect Repo"}
            </Button>
          </SetGithubSourcePopover>
        )}
      </div>
    </div>
  );
}
