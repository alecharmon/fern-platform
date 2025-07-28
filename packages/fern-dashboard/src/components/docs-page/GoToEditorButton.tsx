import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCallback } from "react";
import { preload } from "react-dom";

import {
  ExclamationCircleIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import { Loader2 } from "lucide-react";

import {
  FernTooltip,
  FernTooltipProvider,
} from "@fern-docs/components/FernTooltip";

import { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import { Auth0OrgName } from "@/app/services/auth0/types";
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
  orgName,
  docsUrl,
  session,
  sourceRepo,
  disabled = false,
  disabledReason,
}: {
  orgName: Auth0OrgName;
  docsUrl: DocsUrl;
  session: Auth0SessionData;
  sourceRepo: GithubSourceRepo;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const newBranchName = useMemo(() => {
    const randomHexString = crypto.randomUUID().split("-")[0];
    return (
      new Date().toISOString().split("T")[0] +
      "-" +
      session.user.name?.toLowerCase().replaceAll(" ", "_") +
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
      preload(editorSlug, { as: "document", crossOrigin: "anonymous" });
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
      owner: sourceRepo.owner,
      repo: sourceRepo.repo,
      branch: newBranchName,
      baseBranch: sourceRepo.baseBranch,
    })
      .then((response) => {
        if (response.success) {
          // TODO: client-side nav results in infinite loop, just use browser nav for now
          window.location.href = editorSlug;
          // router.push(editorSlug);
        } else {
          throw new Error();
        }
      })
      .catch(() => {
        ErrorCreateBranchToast();
      });
  }, [sourceRepo, newBranchName, editorSlug]);

  return (
    <FernTooltipProvider>
      <FernTooltip
        content={disabledReason}
        variant="dashboard"
        delayDuration={0}
        className="bg-gray-1200 rounded-md text-white"
      >
        <div className="flex flex-row items-center gap-1">
          <Button
            size="sm"
            className="text-primary hover:text-primary w-fit"
            variant="outline"
            onClick={() => {
              setIsLoading(true);
              createBranch();
            }}
            disabled={isLoading || disabled}
            asChild={!disabled}
          >
            <div className="flex flex-row items-center gap-1">
              {isLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  <PencilSquareIcon />
                  Go to Editor
                </>
              )}
            </div>
          </Button>
          {disabled && disabledReason && (
            <ExclamationCircleIcon className="h-4 w-4 text-red-600" />
          )}
        </div>
      </FernTooltip>
    </FernTooltipProvider>
    // NOTE: This is the UI we want when we have a way to preview branches.
    // <Button
    //   variant="outline"
    //   size="sm"
    //   className="text-primary hover:text-primary"
    //   onClick={() => {
    //     setIsLoading(true);
    //     void createBranch();
    //   }}
    //   disabled={isLoading}
    // >
    //   <PencilSquareIcon className="text-primary" />
    //   Create a Branch
    // </Button>
  );
}
