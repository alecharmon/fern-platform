"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCallback } from "react";
import { preload } from "react-dom";

import { Loader2, Plus } from "lucide-react";

import {
  FernTooltip,
  FernTooltipProvider,
} from "@fern-docs/components/FernTooltip";

import { useOrgName } from "@/app/[orgName]/context/OrgNameContext";
import { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { GithubSourceRepo } from "@/app/services/github/types";
import { ROOT_SLUG_ALIAS, constructEditorSlug } from "@/utils/editor-routing";
import { DocsUrl, EncodedDocsUrl } from "@/utils/types";

import {
  ErrorCreateBranchToast,
  ErrorNoBaseBranchToast,
  ErrorNoGithubSourceToast,
} from "../editor/EditorToasts";
import { Button } from "../ui/button";

export function GoToEditorButton({
  docsUrl,
  session,
  sourceRepo,
  disabled = false,
  isValidatingSource,
}: {
  docsUrl: DocsUrl;
  session: Auth0SessionData;
  sourceRepo?: GithubSourceRepo;
  disabled?: boolean;
  disabledReason?: string;
  isValidatingSource?: boolean;
}) {
  const orgName = useOrgName();
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const newBranchName = useMemo(() => {
    const randomHexString = crypto.randomUUID().split("-")[0];
    return (
      new Date().toISOString().split("T")[0] +
      "-" +
      sanitizeGitHubUsername(session.user.name ?? "") +
      "-" +
      randomHexString
    );
  }, [session.user.name]);

  const editorSlug = useMemo(() => {
    return constructEditorSlug({
      orgName,
      docsUrl: encodeURIComponent(docsUrl) as EncodedDocsUrl,
      branchName: newBranchName,
      slug: ROOT_SLUG_ALIAS,
    });
  }, [orgName, docsUrl, newBranchName]);

  // Preload the editor data and URL in the background
  useEffect(() => {
    if (!disabled) {
      DashboardApiClient.preloadEditorData({
        docsUrl,
      });
      router.prefetch(editorSlug);
      preload(editorSlug, { as: "fetch", crossOrigin: "anonymous" });
    }
  }, [docsUrl, disabled, router, editorSlug]);

  const createBranch = useCallback(() => {
    if (sourceRepo?.owner == null || sourceRepo.repo == null) {
      ErrorNoGithubSourceToast();
      return;
    }
    if (sourceRepo.baseBranch == null) {
      ErrorNoBaseBranchToast();
      return;
    }

    // Very important - the branch creation needs to be finished before navigation
    // TODO: Move the branch creation logic into the editor page
    DashboardApiClient.postCreateBranch({
      orgName,
      owner: sourceRepo.owner,
      repo: sourceRepo.repo,
      branch: newBranchName,
      baseBranch: sourceRepo.baseBranch,
    })
      .then((response) => {
        if (response.success) {
          router.push(editorSlug);
        } else {
          throw new Error();
        }
      })
      .catch((e) => {
        console.error("Error creating branch in GoToEditorButton:", {
          error: e,
          orgName,
          owner: sourceRepo?.owner,
          repo: sourceRepo?.repo,
          branch: newBranchName,
          baseBranch: sourceRepo?.baseBranch,
        });
        ErrorCreateBranchToast();
      });
  }, [sourceRepo, newBranchName, editorSlug, orgName, router]);

  return (
    <div className="flex w-fit flex-row items-center gap-2">
      <FernTooltipProvider>
        <FernTooltip
          content={isValidatingSource ? "Validating source repo..." : undefined}
          variant="dashboard"
          delayDuration={0}
          side="bottom"
          className="bg-gray-1200 rounded-md text-white"
        >
          <span className="pointer-events-auto">
            <Button
              onClick={() => {
                setIsLoading(true);
                createBranch();
              }}
              disabled={isLoading || disabled || isValidatingSource}
              asChild={!disabled}
            >
              <div className="flex flex-row items-center gap-1">
                {isLoading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <>
                    <Plus />
                    New session
                  </>
                )}
              </div>
            </Button>
          </span>
        </FernTooltip>
      </FernTooltipProvider>
    </div>
  );
}

// Ensures branch name is url encodable
function sanitizeGitHubUsername(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
}
