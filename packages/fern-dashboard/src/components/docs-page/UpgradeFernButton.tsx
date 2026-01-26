"use client";

import { ExternalLink, Loader2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { checkVersionUpgradeAction } from "@/app/actions/checkVersionUpgrade";
import { upgradeFernVersionAction } from "@/app/actions/upgradeFernVersion";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { useBackgroundPoller } from "@/hooks/useBackgroundPoller";
import type { DocsUrl } from "@/utils/types";
import { cn } from "@/utils/utils";
import { ErrorUpgradeFernCliVersionToast } from "../editor/EditorToasts";
import { Button } from "../ui/button";

type UpgradeFernButtonVariant = "outline" | "black";

interface UpgradeFernButtonProps {
    orgName: Auth0OrgName;
    docsUrl: DocsUrl;
    gitUrl: string;
    currentVersion: string;
    latestVersion: string;
    baseBranch: string;
    existingPr?: {
        exists: boolean;
        prUrl?: string;
        prNumber?: number;
    };
    variant?: UpgradeFernButtonVariant;
    abbreviateText?: boolean;
}

export function UpgradeFernButton({
    orgName,
    docsUrl,
    gitUrl,
    currentVersion,
    latestVersion,
    baseBranch,
    existingPr,
    variant = "outline",
    abbreviateText = false
}: UpgradeFernButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState<string>("");
    const [currentPr, setCurrentPr] = useState(existingPr);
    const [textOpacity, setTextOpacity] = useState(1);

    // Polling configuration: only starts when user manually clicks upgrade
    // Relies on visibility change events to detect upgrades when user returns to dashboard
    const { startPolling } = useBackgroundPoller(
        async () => {
            const result = await checkVersionUpgradeAction(gitUrl, docsUrl, baseBranch, latestVersion);
            return result.upgraded; // Return true to stop polling
        },
        {
            autoStart: false, // Don't auto-start to minimize GitHub API usage
            pollingInterval: 60 * 1000, // 60 seconds - less frequent polling
            maxPollingTime: 30 * 60 * 1000 // 30 minutes max
        }
    );

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
            smoothTransitionStep("Opening a pull request...", 1000);
            smoothTransitionStep("Finalizing...", 2000);

            const result = await upgradeFernVersionAction(
                orgName,
                docsUrl,
                gitUrl,
                currentVersion,
                latestVersion,
                baseBranch
            );

            if (result.success && result.prUrl) {
                // Update state to show the newly created PR
                setCurrentPr({
                    exists: true,
                    prUrl: result.prUrl,
                    prNumber: result.prNumber
                });

                // Start polling to detect when the PR is merged
                startPolling();

                // Open the PR in a new tab
                window.open(result.prUrl, "_blank", "noopener,noreferrer");
            } else {
                ErrorUpgradeFernCliVersionToast(result.error);
            }
        } catch (error) {
            ErrorUpgradeFernCliVersionToast(error instanceof Error ? error.message : "");
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

    const buttonText = useMemo(() => {
        if (isLoading) {
            return loadingStep;
        }
        if (abbreviateText) {
            return hasExistingPr ? "View pull request" : "Upgrade";
        }

        return hasExistingPr ? "Finish CLI upgrade" : `Upgrade to ${latestVersion}`;
    }, [isLoading, loadingStep, hasExistingPr, latestVersion, abbreviateText]);

    return (
        <Button
            onClick={hasExistingPr ? handleViewPr : () => void handleUpgrade()}
            disabled={isLoading}
            variant={variant === "black" ? "default" : "outline"}
            size={variant === "black" ? "default" : "xs"}
            className={cn(
                "flex items-center gap-1",
                variant === "black" &&
                    "bg-black text-white hover:bg-black/70 dark:bg-white dark:text-black dark:hover:bg-white/70"
            )}
        >
            {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
            ) : hasExistingPr ? (
                <ExternalLink className="size-4" />
            ) : (
                <Sparkles className="size-4" />
            )}
            <span className="transition-opacity duration-300 ease-in-out" style={{ opacity: textOpacity }}>
                {buttonText}
            </span>
        </Button>
    );
}
