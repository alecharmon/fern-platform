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
import { generateBranchName } from "@fern-docs/components/navigation/local-storage";

import { useOrgName } from "@/app/[orgName]/context/OrgNameContext";
import { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { GithubSourceRepo } from "@/app/services/github/types";
import { ROOT_SLUG_ALIAS, constructEditorSlug } from "@/utils/editor-routing";
import { DocsUrl, EncodedDocsUrl } from "@/utils/types";

import {
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

  const newBranchName = useMemo(
    () => generateBranchName(session.user.sub, session.user.name),
    [session.user.name, session.user.sub]
  );

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

  const goToEditor = useCallback(() => {
    if (sourceRepo?.owner == null || sourceRepo.repo == null) {
      ErrorNoGithubSourceToast();
      return;
    }
    if (sourceRepo.baseBranch == null) {
      ErrorNoBaseBranchToast();
      return;
    }

    router.push(editorSlug);
  }, [sourceRepo, editorSlug, router]);

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
                goToEditor();
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
