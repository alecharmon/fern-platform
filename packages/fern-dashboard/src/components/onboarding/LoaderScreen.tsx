"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AddCollaboratorModal } from "@/components/shared/AddCollaboratorModal";
import type { WizardFormData } from "@/providers/OnboardingProvider";
import { Button } from "../ui/button";
import { ProgressTimeline } from "./loader-screen/ProgressTimeline";
import { usePublishingWorkflow } from "./loader-screen/usePublishingWorkflow";
import { WorkflowFailedBanner } from "./loader-screen/WorkflowFailedBanner";

interface LoaderScreenProps {
    wizardFormData: WizardFormData;
    orgName?: string;
    onComplete?: (result: { url: string; fernDocsDownloadUrl?: string; githubRepoUrl?: string }) => void;
}

export function LoaderScreen({ wizardFormData, orgName, onComplete }: LoaderScreenProps) {
    const {
        isComplete,
        workflowFailed,
        isRetrying,
        error,
        stepStates,
        githubRepoUrl,
        docsUrl,
        docsStepLabel,
        isCollaboratorModalOpen,
        showSlowPublishingWarning,
        handleRetryWorkflow,
        setIsCollaboratorModalOpen
    } = usePublishingWorkflow({ wizardFormData, orgName, onComplete });

    // Extract repo name from URL (e.g., https://github.com/fern-support/my-repo -> my-repo)
    const repoName = githubRepoUrl?.split("/").pop() ?? "";

    const dashboardLink = useMemo(() => {
        if (docsUrl) {
            const cleanedUrl = new URL(docsUrl);
            const url = cleanedUrl.host;
            return `/${orgName}/docs/${url}`;
        }
        return undefined;
    }, [docsUrl, orgName]);

    const githubActionsUrl = useMemo(() => {
        if (githubRepoUrl) {
            return `${githubRepoUrl}/actions`;
        }
        return undefined;
    }, [githubRepoUrl]);

    const heading = isComplete
        ? "Your site is published!"
        : workflowFailed
          ? "Publishing failed"
          : "Your site is publishing!";

    return (
        <div className="flex w-full flex-col gap-8">
            <h1 className="text-xl font-semibold text-left">{heading}</h1>

            <ProgressTimeline
                stepStates={stepStates}
                docsStepLabel={docsStepLabel}
                docsUrl={docsUrl}
                onAddCollaboratorClick={() => setIsCollaboratorModalOpen(true)}
            />

            {(isComplete || workflowFailed) && dashboardLink && (
                <Button asChild>
                    <Link href={dashboardLink} prefetch>
                        Go to dashboard
                    </Link>
                </Button>
            )}

            {workflowFailed && (
                <WorkflowFailedBanner
                    githubActionsUrl={githubActionsUrl}
                    isRetrying={isRetrying}
                    onRetry={handleRetryWorkflow}
                />
            )}

            {orgName && repoName && docsUrl && (
                <AddCollaboratorModal
                    open={isCollaboratorModalOpen}
                    onOpenChange={setIsCollaboratorModalOpen}
                    orgName={orgName}
                    repoName={repoName}
                    docsUrl={docsUrl.replace("https://", "")}
                />
            )}

            {error && (
                <div className="border-border w-full max-w-3xl rounded-lg border bg-white p-4 text-sm text-red-800 dark:border-red-800 dark:bg-black dark:text-red-400">
                    {error}
                </div>
            )}

            {showSlowPublishingWarning && !isComplete && !workflowFailed && (
                <p className="text-sm text-muted-foreground">This is taking longer than usual. Check back in a few!</p>
            )}
        </div>
    );
}
