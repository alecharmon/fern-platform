"use client";

import { useState } from "react";

import { ExternalLink, Loader2, SparklesIcon } from "lucide-react";

import { upgradeFernVersionAction } from "@/app/actions/upgradeFernVersion";
import { Auth0OrgName } from "@/app/services/auth0/types";
import { DocsUrl } from "@/utils/types";

import { ErrorUpgradeFernCliVersionToast } from "../editor/EditorToasts";
import { Button } from "../ui/button";

interface UpgradeFernButtonProps {
  orgName: Auth0OrgName;
  docsUrl: DocsUrl;
  githubUrl: string;
  currentVersion: string;
  latestVersion: string;
  baseBranch: string;
  existingPr?: {
    exists: boolean;
    prUrl?: string;
    prNumber?: number;
  };
  primary?: boolean;
}

export function UpgradeFernButton({
  orgName,
  docsUrl,
  githubUrl,
  currentVersion,
  latestVersion,
  baseBranch,
  existingPr,
  primary = false,
}: UpgradeFernButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [currentPr, setCurrentPr] = useState(existingPr);
  const [textOpacity, setTextOpacity] = useState(1);

  const smoothTransitionStep = (newStep: string, delay: number) => {
    setTimeout(() => {
      setTextOpacity(0);
      setTimeout(() => {
        setLoadingStep(newStep);
        setTextOpacity(1);
      }, 150); // Half the transition duration
    }, delay);
  };

  const handleUpgrade = async () => {
    setIsLoading(true);
    setLoadingStep("Creating branch...");

    try {
      // The server action handles all the steps, so we update UI optimistically
      smoothTransitionStep("Opening upgrade PR...", 1000);
      smoothTransitionStep("Finalizing...", 2000);

      const result = await upgradeFernVersionAction(
        orgName,
        docsUrl,
        githubUrl,
        currentVersion,
        latestVersion,
        baseBranch
      );

      if (result.success && result.prUrl) {
        // Update state to show the newly created PR
        setCurrentPr({
          exists: true,
          prUrl: result.prUrl,
          prNumber: result.prNumber,
        });

        // Open the PR in a new tab
        window.open(result.prUrl, "_blank", "noopener,noreferrer");
      } else {
        ErrorUpgradeFernCliVersionToast(result.error);
      }
    } catch (error) {
      ErrorUpgradeFernCliVersionToast(
        error instanceof Error ? error.message : ""
      );
    } finally {
      setIsLoading(false);
      setLoadingStep("");
      setTextOpacity(1);
    }
  };

  const handleViewPr = () => {
    if (currentPr?.prUrl) {
      window.open(currentPr.prUrl, "_blank", "noopener,noreferrer");
    }
  };

  const hasExistingPr = currentPr?.exists && currentPr?.prUrl;

  return (
    <Button
      onClick={hasExistingPr ? handleViewPr : () => void handleUpgrade()}
      disabled={isLoading}
      variant={primary ? "default" : "outline"}
      className="flex items-center gap-2"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : hasExistingPr ? (
        <ExternalLink className="h-4 w-4" />
      ) : (
        <SparklesIcon className="h-4 w-4" />
      )}
      <span
        className="transition-opacity duration-300 ease-in-out"
        style={{ opacity: textOpacity }}
      >
        {isLoading
          ? loadingStep
          : hasExistingPr
            ? "Finish CLI upgrade"
            : `Upgrade CLI to ${latestVersion}`}
      </span>
    </Button>
  );
}
