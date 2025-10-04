"use client";

import { useMemo, useState } from "react";

import SparklesIcon from "@heroicons/react/24/outline/SparklesIcon";
import { ExternalLink, Loader2 } from "lucide-react";

import { upgradeFernVersionAction } from "@/app/actions/upgradeFernVersion";
import { Auth0OrgName } from "@/app/services/auth0/types";
import { DocsUrl } from "@/utils/types";
import { cn } from "@/utils/utils";

import { ErrorUpgradeFernCliVersionToast } from "../editor/EditorToasts";
import { Button } from "../ui/button";

type UpgradeFernButtonVariant = "outline" | "black";

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
    variant?: UpgradeFernButtonVariant;
    abbreviateText?: boolean;
}

export function UpgradeFernButton({
    orgName,
    docsUrl,
    githubUrl,
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
                    prNumber: result.prNumber
                });

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
            return hasExistingPr ? "Finish upgrade" : "Upgrade";
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
                <SparklesIcon className="size-4" />
            )}
            <span className="transition-opacity duration-300 ease-in-out" style={{ opacity: textOpacity }}>
                {buttonText}
            </span>
        </Button>
    );
}
